// Immutable graph data model.
// All functions return a new graph object — no mutation.

export function createGraph() {
  return { nodes: [], edges: [], _nextId: 0 };
}

export function addNode(graph, type, x, y) {
  const id = graph._nextId;
  return {
    ...graph,
    nodes: [...graph.nodes, { id, type, x, y }],
    _nextId: id + 1,
  };
}

export function addEdge(graph, fromId, toId) {
  const id = graph._nextId;
  return {
    ...graph,
    edges: [...graph.edges, { id, from: fromId, to: toId }],
    _nextId: graph._nextId + 1,
  };
}

export function removeNode(graph, id) {
  return {
    ...graph,
    nodes: graph.nodes.filter(n => n.id !== id),
    edges: graph.edges.filter(e => e.from !== id && e.to !== id),
  };
}

export function removeEdge(graph, id) {
  return {
    ...graph,
    edges: graph.edges.filter(e => e.id !== id),
  };
}

export function updateNodePosition(graph, id, x, y) {
  return {
    ...graph,
    nodes: graph.nodes.map(n => n.id === id ? { ...n, x, y } : n),
  };
}

export function getNode(graph, id) {
  return graph.nodes.find(n => n.id === id);
}

export function getNeighbours(graph, nodeId) {
  return graph.edges
    .filter(e => e.from === nodeId || e.to === nodeId)
    .map(e => (e.from === nodeId ? e.to : e.from));
}

export function countLegs(graph, nodeId) {
  return graph.edges.filter(e => e.from === nodeId || e.to === nodeId).length;
}

export function internalEdges(graph) {
  const vertexIds = new Set(graph.nodes.filter(n => n.type === 'vertex').map(n => n.id));
  return graph.edges.filter(e => vertexIds.has(e.from) && vertexIds.has(e.to));
}

export function externalEdges(graph) {
  const externalIds = new Set(graph.nodes.filter(n => n.type === 'external').map(n => n.id));
  return graph.edges.filter(e => externalIds.has(e.from) || externalIds.has(e.to));
}

// L = I − V + C  (C = number of connected components, 1 for a connected diagram)
export function countLoops(graph) {
  const V = graph.nodes.filter(n => n.type === 'vertex').length;
  const I = internalEdges(graph).length;
  if (V === 0) return 0;
  return I - V + 1;
}

export function loadFromJSON(json) {
  const maxId = Math.max(
    ...json.nodes.map(n => n.id),
    ...json.edges.map(e => e.id),
    -1,
  );
  return { nodes: json.nodes, edges: json.edges, _nextId: maxId + 1 };
}
