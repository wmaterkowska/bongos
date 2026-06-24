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

// Swaps an edge's endpoints, reversing the direction momentum is routed
// through it (see src/momentum.js, which treats from -> to as the flow
// direction). Every other consumer of edges (rules.js, automorphism.js) is
// direction-agnostic, so this is the only place "direction" means anything.
export function flipEdge(graph, id) {
  return {
    ...graph,
    edges: graph.edges.map(e => (e.id === id ? { ...e, from: e.to, to: e.from } : e)),
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
  return graph.edges.reduce((count, e) => {
    if (e.from === nodeId && e.to === nodeId) return count + 2; // self-loop: both ends attach here
    if (e.from === nodeId || e.to === nodeId) return count + 1;
    return count;
  }, 0);
}

export function internalEdges(graph) {
  const vertexIds = new Set(graph.nodes.filter(n => n.type === 'vertex').map(n => n.id));
  return graph.edges.filter(e => vertexIds.has(e.from) && vertexIds.has(e.to));
}

export function externalEdges(graph) {
  const externalIds = new Set(graph.nodes.filter(n => n.type === 'external').map(n => n.id));
  return graph.edges.filter(e => externalIds.has(e.from) || externalIds.has(e.to));
}

// Groups of nodes reachable from one another via edges (self-loops don't
// connect a node to anything new, but don't break its own component either).
export function connectedComponents(graph) {
  const visited = new Set();
  const components = [];
  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;
    const component = [];
    const stack = [node.id];
    visited.add(node.id);
    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);
      for (const neighbour of getNeighbours(graph, current)) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          stack.push(neighbour);
        }
      }
    }
    components.push(component);
  }
  return components;
}

// L = I − V + C, where C is the number of connected components of the
// vertex/internal-edge subgraph (external legs don't add loops, they're
// pendant decorations) -- C is 1 for an ordinary, connected diagram, but
// isn't hardcoded to 1, since a diagram can have several disconnected pieces.
export function countLoops(graph) {
  const vertices = graph.nodes.filter(n => n.type === 'vertex');
  const V = vertices.length;
  if (V === 0) return 0;
  const internal = internalEdges(graph);
  const I = internal.length;
  const C = connectedComponents({ nodes: vertices, edges: internal }).length;
  return I - V + C;
}

export function loadFromJSON(json) {
  const maxId = Math.max(
    ...json.nodes.map(n => n.id),
    ...json.edges.map(e => e.id),
    -1,
  );
  return { nodes: json.nodes, edges: json.edges, _nextId: maxId + 1 };
}
