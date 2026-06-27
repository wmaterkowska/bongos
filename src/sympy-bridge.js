// Lazily loads the Pyodide WASM Python runtime, plus SymPy and py/simplify.py,
// once per page session. Pyodide itself is loaded as a global via the
// <script> tag in index.html (the same pattern already used there for
// KaTeX) — this module manages the async loadPyodide()/loadPackage()
// lifecycle and caches the result so repeated calls never reload anything.

import { internalEdges, isVertexNode, isExternalNode } from './graph.js';
import { routeMomenta } from './momentum.js';

let _pyodidePromise = null;
let _ready = false;

// Whether the runtime has already finished loading — lets the UI show a
// one-time "loading symbolic engine…" message instead of "simplifying…"
// for the slow first call.
export function isPyodideReady() {
  return _ready;
}

function getPyodide() {
  if (!_pyodidePromise) {
    _pyodidePromise = loadPyodide().then(async pyodide => {
      await pyodide.loadPackage('sympy');
      const source = await fetch('py/simplify.py', { cache: 'no-store' }).then(res => res.text());
      pyodide.runPython(source);
      _ready = true;
      return pyodide;
    });
  }
  return _pyodidePromise;
}

// ── QED payload builder ───────────────────────────────────────────────────────
//
// Extracts fermion chain topology from the graph and assembles the full
// structured payload for simplify_qed_amplitude in py/simplify.py.
//
// Open chains (external-in → vertices → external-out) are represented as
//   { type:'open', rightSpinor, leftSpinor, steps }
// where steps are in arrow-traversal order and Python reverses them when
// writing the amplitude left-to-right.
//
// Closed loops are represented as { type:'loop', steps } in traversal order
// (the trace notation is left-to-right along the fermion arrow).
//
// Each QED vertex is assigned a Lorentz index μ_N (sorted by node id) which
// appears in the γ^{μ_N} factor in the chain AND in the matching photon
// propagator or external polarisation.

function buildQEDPayload(graph, symmetryFactor) {
  const momenta = routeMomenta(graph);

  // Re-derive ext leg info — same sort order as analyseGraph in rules.js
  // so that p₁, p₂, … labels match the canvas momentum labels.
  const extNodes = graph.nodes.filter(isExternalNode).sort((a, b) => a.id - b.id);
  const legMap = new Map(); // nodeId → { spinorType, symbol }
  extNodes.forEach((n, i) => {
    const sym  = `p_{${i + 1}}`;
    const edge = graph.edges.find(e => e.from === n.id || e.to === n.id);
    let spinorType = null;
    if (edge) {
      const fromExt = edge.from === n.id;
      if      (n.type === 'fermion-ext')  spinorType = fromExt ? 'u'      : 'ubar';
      else if (n.type === 'positron-ext') spinorType = fromExt ? 'v'      : 'vbar';
      else if (n.type === 'photon-ext')   spinorType = fromExt ? 'eps'    : 'epsstar';
    }
    legMap.set(n.id, { spinorType, symbol: sym });
  });

  // Assign Lorentz index μ_N to each QED vertex (sorted by id).
  const vertices = graph.nodes.filter(isVertexNode).sort((a, b) => a.id - b.id);
  const muIndex  = new Map(); // vertexId → '\\mu_{N}'
  vertices.forEach((v, i) => muIndex.set(v.id, `\\mu_{${i + 1}}`));

  // Fermion edge adjacency: one outgoing and one incoming fermion edge per node.
  const outFermion = new Map(); // nodeId → outgoing fermion edge
  for (const e of graph.edges) {
    if (e.edgeType === 'fermion') outFermion.set(e.from, e);
  }

  const visited = new Set();
  const chains  = [];

  // ── Open chains ──────────────────────────────────────────────────────────
  for (const start of extNodes) {
    if (visited.has(start.id) || !outFermion.has(start.id)) continue;
    visited.add(start.id);

    const startLeg = legMap.get(start.id);
    const steps    = [];
    let current    = start;
    let endLeg     = null;

    while (true) {
      const outEdge = outFermion.get(current.id);
      if (!outEdge) break;
      const next = graph.nodes.find(n => n.id === outEdge.to);
      if (!next) break;

      if (isVertexNode(next)) {
        steps.push({ kind: 'gamma', index: muIndex.get(next.id) });
        // If the next outgoing fermion edge is also internal, insert propagator.
        const nextOut = outFermion.get(next.id);
        if (nextOut) {
          const afterNext = graph.nodes.find(n => n.id === nextOut.to);
          if (afterNext && isVertexNode(afterNext)) {
            steps.push({ kind: 'propagator', momentum: momenta.get(nextOut.id) ?? null });
          }
        }
        visited.add(next.id);
        current = next;
      } else {
        visited.add(next.id);
        endLeg = legMap.get(next.id);
        break;
      }
    }

    if (endLeg) {
      chains.push({ type: 'open', rightSpinor: startLeg, leftSpinor: endLeg, steps });
    }
  }

  // ── Closed loops ─────────────────────────────────────────────────────────
  for (const start of vertices) {
    if (visited.has(start.id)) continue;
    visited.add(start.id);

    const steps = [{ kind: 'gamma', index: muIndex.get(start.id) }];
    let current = start;

    for (let guard = 0; guard < 500; guard++) {
      const outEdge = outFermion.get(current.id);
      if (!outEdge) break;
      const next = graph.nodes.find(n => n.id === outEdge.to);
      if (!next) break;
      const mom = momenta.get(outEdge.id) ?? null;
      if (next.id === start.id) {
        steps.push({ kind: 'propagator', momentum: mom });
        break;
      }
      steps.push({ kind: 'propagator', momentum: mom });
      steps.push({ kind: 'gamma', index: muIndex.get(next.id) });
      visited.add(next.id);
      current = next;
    }

    chains.push({ type: 'loop', steps });
  }

  // ── Photon factors ────────────────────────────────────────────────────────
  const handledPhoton  = new Set();
  const photonFactors  = [];
  const internalPhotons = [];

  for (const v of vertices) {
    const photonEdge = graph.edges.find(e =>
      e.edgeType === 'photon'
      && (e.from === v.id || e.to === v.id)
      && !handledPhoton.has(e.id)
    );
    if (!photonEdge) continue;
    handledPhoton.add(photonEdge.id);

    const idx     = muIndex.get(v.id);
    const otherId = photonEdge.from === v.id ? photonEdge.to : photonEdge.from;
    const other   = graph.nodes.find(n => n.id === otherId);

    if (other && isVertexNode(other)) {
      internalPhotons.push({
        index1: idx,
        index2: muIndex.get(other.id),
        momentum: momenta.get(photonEdge.id) ?? null,
      });
    } else if (other) {
      const leg = legMap.get(other.id);
      if (leg) photonFactors.push({ index: idx, spinorType: leg.spinorType, symbol: leg.symbol });
    }
  }

  return JSON.stringify({
    theory: 'qed',
    vertexCount: vertices.length,
    symmetryFactor,
    fermionChains: chains,
    internalPhotons,
    photonFactors,
  });
}

// Symbolically simplifies the combined amplitude for `graph` and returns
// its LaTeX. The JS<->Python boundary is a single JSON string each way
// (see simplify_amplitude_json in py/simplify.py) so there's no need to
// reason about Pyodide's JS-array/object proxy conversions.
export async function simplifyAmplitude(graph, symmetryFactor, theory) {
  const pyodide = await getPyodide();

  let payload;
  if (theory?.supportsEdgeTypes) {
    payload = buildQEDPayload(graph, symmetryFactor);
  } else {
    const vertexCount = graph.nodes.filter(isVertexNode).length;
    const momenta = routeMomenta(graph);
    payload = JSON.stringify({
      theory: 'scalar',
      vertexCount,
      propagators: internalEdges(graph).map(e => momenta.get(e.id)).filter(Boolean),
      symmetryFactor,
    });
  }

  const simplifyAmplitudeJson = pyodide.globals.get('simplify_amplitude_json');
  return simplifyAmplitudeJson(payload);
}
