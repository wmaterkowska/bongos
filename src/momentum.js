// Momentum routing: assigns a MomentumExpr to every edge such that momentum
// is conserved at every vertex. Pure function, no DOM.
//
// MomentumExpr = { terms: [{ sign: 1 | -1, symbol: string }] }
//
// External legs get fixed momenta p_{1}, p_{2}, ... in node-creation order,
// flowing from the external node into the vertex. Internal edges split into
// a spanning tree (V-1 edges) plus L = I-(V-1) non-tree edges; the non-tree
// edges get free loop momenta k_{1}...k_{L} (self-loops and extra parallel
// lines always end up non-tree, since they never connect two previously
// unconnected vertices). The spanning-tree edges are then solved one at a
// time, leaves before their parent, by conservation at each vertex: a
// vertex's own conservation equation is used to pin down its one remaining
// unknown (the edge to its parent) from everything already known about it.
// The root of each component never needs its own equation — it's the
// redundant one, implied by the others plus overall momentum conservation.

import { internalEdges, isVertexNode, isExternalNode } from './graph.js';

export function routeMomenta(graph) {
  const vertices = graph.nodes.filter(isVertexNode);
  if (vertices.length === 0) return new Map();
  const vertexIds = new Set(vertices.map(v => v.id));

  const result = new Map(); // edgeId -> MomentumExpr

  // External legs: fixed momenta p_{1}, p_{2}, ... in node-creation order,
  // defined as flowing from the external node into the vertex.
  const externals = graph.nodes
    .filter(isExternalNode)
    .sort((a, b) => a.id - b.id);
  const externalSymbol = new Map(externals.map((n, i) => [n.id, `p_{${i + 1}}`]));

  for (const e of graph.edges) {
    const fromIsVertex = vertexIds.has(e.from);
    const toIsVertex = vertexIds.has(e.to);
    if (fromIsVertex && toIsVertex) continue; // internal — handled below
    if (!fromIsVertex && !toIsVertex) continue; // edge between two external nodes — not meaningful here
    const extId = fromIsVertex ? e.to : e.from;
    const sign = fromIsVertex ? -1 : 1; // flip sign when the edge points vertex -> external
    result.set(e.id, { terms: [{ sign, symbol: externalSymbol.get(extId) }] });
  }

  // Spanning tree of the vertex graph via union-find. Self-loops never
  // union two distinct components, so they — and any extra parallel edge
  // between an already-connected pair — fall out as non-tree edges for free.
  const parent = new Map(vertices.map(v => [v.id, v.id]));
  const find = x => {
    while (parent.get(x) !== x) x = parent.get(x);
    return x;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra === rb) return false;
    parent.set(ra, rb);
    return true;
  };

  const treeEdges = [];
  const loopEdges = [];
  for (const e of internalEdges(graph)) {
    (union(e.from, e.to) ? treeEdges : loopEdges).push(e);
  }

  // Non-tree edges: free loop momenta k_{1}, k_{2}, ... flowing from -> to.
  [...loopEdges]
    .sort((a, b) => a.id - b.id)
    .forEach((e, i) => {
      result.set(e.id, { terms: [{ sign: 1, symbol: `k_{${i + 1}}` }] });
    });

  // Tree edges: solved by conservation, processing leaves before their
  // parent (post-order) so every non-root vertex has exactly one unknown —
  // its parent edge — by the time it's visited. Each unvisited vertex starts
  // a new component, in case the diagram isn't fully connected.
  const adjacency = new Map(vertices.map(v => [v.id, []]));
  for (const e of treeEdges) {
    adjacency.get(e.from).push({ neighbour: e.to, edge: e });
    adjacency.get(e.to).push({ neighbour: e.from, edge: e });
  }

  const parentEdge = new Map(); // vertexId -> tree edge connecting it to its parent
  const postOrder = [];
  const visited = new Set();
  function visit(v) {
    for (const { neighbour, edge } of adjacency.get(v)) {
      if (visited.has(neighbour)) continue;
      visited.add(neighbour);
      parentEdge.set(neighbour, edge);
      visit(neighbour);
    }
    postOrder.push(v);
  }
  for (const v of vertices) {
    if (!visited.has(v.id)) {
      visited.add(v.id);
      visit(v.id);
    }
  }

  for (const v of postOrder) {
    const pe = parentEdge.get(v);
    if (!pe) continue; // a component root — its equation is the redundant one

    const otherTerms = [];
    for (const e of graph.edges) {
      if (e.id === pe.id) continue;
      const expr = result.get(e.id);
      if (!expr) continue;
      if (e.to === v) otherTerms.push(...expr.terms);
      if (e.from === v) otherTerms.push(...flipTerms(expr.terms));
    }

    const signAtV = pe.to === v ? 1 : -1;
    result.set(pe.id, { terms: simplifyTerms(flipTerms(otherTerms, -signAtV)) });
  }

  return result;
}

function flipTerms(terms, factor = -1) {
  return terms.map(t => ({ sign: factor * t.sign, symbol: t.symbol }));
}

// Cancels opposite-signed copies of the same symbol (e.g. a self-loop's
// +k_1/-k_1 contribution at its own vertex), without merging same-signed
// copies into a coefficient — MomentumExpr terms are always sign * symbol.
function simplifyTerms(terms) {
  const netSign = new Map();
  for (const { sign, symbol } of terms) {
    netSign.set(symbol, (netSign.get(symbol) || 0) + sign);
  }
  const simplified = [];
  for (const [symbol, net] of netSign) {
    const sign = net > 0 ? 1 : -1;
    for (let i = 0; i < Math.abs(net); i++) simplified.push({ sign, symbol });
  }
  return simplified;
}
