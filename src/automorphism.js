// Stage 5b: general symmetry factor via graph automorphism counting.
// S = |Aut(Γ)|, the number of ways to relabel internal vertices and internal
// propagators that leaves the diagram unchanged, with external legs held
// fixed (each is a distinguishable physical particle, never permuted).
//
// A vertex with any external leg attached is pinned to itself — no other
// vertex carries that same external tag, so it can never be relabelled away.
// Unpinned ("free") vertices may swap with other free vertices of the same
// degree. For a candidate vertex permutation ρ, the number of compatible
// relabellings of the internal lines themselves is, per vertex pair:
//   - m parallel lines between two distinct vertices → m! ways to match them up
//   - k self-loops at one vertex → k! ways to match the loops, times 2 per
//     loop for flipping which end is which (e.g. the figure-8 vacuum bubble:
//     2 self-loops at one vertex → 2! * 2^2 = 8).
// Summing this count over every structure-preserving ρ gives S.

import { internalEdges, externalEdges, isVertexNode } from './graph.js';

export function computeAutomorphismCount(graph) {
  const vertices = graph.nodes.filter(isVertexNode).map(n => n.id);
  if (vertices.length === 0) return 1;

  const internal = internalEdges(graph);
  const external = externalEdges(graph);

  const externalTagCount = new Map(vertices.map(v => [v, 0]));
  for (const e of external) {
    const vertexEnd = vertices.includes(e.from) ? e.from : e.to;
    externalTagCount.set(vertexEnd, externalTagCount.get(vertexEnd) + 1);
  }

  const selfLoopCount = new Map(vertices.map(v => [v, 0]));
  const pairEdgeCount = new Map(); // `${a}-${b}` (a<b) -> count, for scalar/photon (undirected)
  const fermionPairCount = new Map(); // `${from}:${to}` -> count, for fermion (directed)
  const degree = new Map(vertices.map(v => [v, 0]));
  for (const e of internal) {
    degree.set(e.from, degree.get(e.from) + 1);
    degree.set(e.to, degree.get(e.to) + 1);
    if (e.from === e.to) {
      selfLoopCount.set(e.from, selfLoopCount.get(e.from) + 1);
    } else if ((e.edgeType ?? 'scalar') === 'fermion') {
      const key = `${e.from}:${e.to}`;
      fermionPairCount.set(key, (fermionPairCount.get(key) || 0) + 1);
    } else {
      const key = pairKey(e.from, e.to);
      pairEdgeCount.set(key, (pairEdgeCount.get(key) || 0) + 1);
    }
  }

  // Group vertices into the blocks ρ is allowed to permute within: a vertex
  // with an external leg only ever maps to itself; free vertices only ever
  // map to other free vertices of the same degree.
  const groups = [];
  const freeByDegree = new Map();
  for (const v of vertices) {
    if (externalTagCount.get(v) > 0) {
      groups.push([v]);
      continue;
    }
    const d = degree.get(v);
    if (!freeByDegree.has(d)) freeByDegree.set(d, []);
    freeByDegree.get(d).push(v);
  }
  for (const group of freeByDegree.values()) groups.push(group);

  let total = 0;
  for (const rho of permutationsWithinGroups(groups)) {
    total += contributionFor(rho, vertices, selfLoopCount, pairEdgeCount, fermionPairCount);
  }
  return total;
}

function pairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// Number of half-edge-level automorphisms compatible with vertex permutation
// rho, or 0 if rho doesn't preserve the diagram's internal-line structure.
function contributionFor(rho, vertices, selfLoopCount, pairEdgeCount, fermionPairCount) {
  let factor = 1;

  for (const v of vertices) {
    const k = selfLoopCount.get(v);
    if (k !== selfLoopCount.get(rho.get(v))) return 0;
    if (k > 0) factor *= factorial(k) * 2 ** k;
  }

  // Undirected pairs (scalar / photon): existing behaviour unchanged.
  for (const v of vertices) {
    for (const w of vertices) {
      if (v >= w) continue;
      const m = pairEdgeCount.get(pairKey(v, w)) || 0;
      if (m === 0) continue;
      const mImage = pairEdgeCount.get(pairKey(rho.get(v), rho.get(w))) || 0;
      if (m !== mImage) return 0;
      factor *= factorial(m);
    }
  }

  // Directed pairs (fermion): V0→V1 and V1→V0 are distinct propagators and
  // are NOT interchangeable, so they each get their own directed key.
  // Use a done-set so each pair is counted once even when ρ maps A→B and B→A.
  const doneFermion = new Set();
  for (const [key, m] of fermionPairCount) {
    if (doneFermion.has(key)) continue;
    const [a, b] = key.split(':').map(Number);
    const imageKey = `${rho.get(a)}:${rho.get(b)}`;
    const mImage = fermionPairCount.get(imageKey) || 0;
    if (m !== mImage) return 0;
    factor *= factorial(m);
    doneFermion.add(key);
    doneFermion.add(imageKey);
  }

  return factor;
}

function* permutationsOf(arr) {
  if (arr.length <= 1) {
    yield arr.slice();
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutationsOf(rest)) {
      yield [arr[i], ...perm];
    }
  }
}

// Cartesian product of "permute within this group" across all groups,
// combined into a single vertex -> vertex map.
function* permutationsWithinGroups(groups) {
  function* combos(idx) {
    if (idx === groups.length) {
      yield [];
      return;
    }
    for (const perm of permutationsOf(groups[idx])) {
      for (const rest of combos(idx + 1)) {
        yield [perm, ...rest];
      }
    }
  }

  for (const combo of combos(0)) {
    const rho = new Map();
    groups.forEach((group, i) => {
      group.forEach((v, j) => rho.set(v, combo[i][j]));
    });
    yield rho;
  }
}
