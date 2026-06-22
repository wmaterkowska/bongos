import { addNode, addEdge, removeNode, removeEdge, updateNodePosition, getNode, countLegs } from './graph.js';
import { NODE_RADIUS } from './constants.js';

const EDGE_LAYER = document.getElementById('edges-layer');
const NODE_LAYER = document.getElementById('nodes-layer');

const PARALLEL_SPACING = 16;     // px between fanned-out lines sharing a node pair
const LOOP_RADIUS = 26;          // how far a self-loop bulges from its vertex
const LOOP_SPREAD = Math.PI / 7; // angular half-width of a self-loop's neck

let _graph = null;
let _theory = null;
let _onGraphChange = null;
let _selectedNodeId = null;
let _dragging = null; // { nodeId, offsetX, offsetY, moved }
let _justDragged = false; // suppresses the click that follows a drag release

// ── Public API ────────────────────────────────────────────────────────

export function initCanvas(svgEl, graph, theory, onGraphChange) {
  _graph = graph;
  _theory = theory;
  _onGraphChange = onGraphChange;

  // Drop from palette
  svgEl.addEventListener('dragover', e => e.preventDefault());
  svgEl.addEventListener('drop', onDrop);

  // Drag-to-reposition
  svgEl.addEventListener('mousemove', onMouseMove);
  svgEl.addEventListener('mouseup', onMouseUp);

  // Clicking empty canvas cancels a pending node selection
  svgEl.addEventListener('click', onBackgroundClick);

  render();
}

export function updateGraph(graph) {
  _graph = graph;
  _selectedNodeId = null;
  _dragging = null;
  render();
}

export function setTheory(theory) {
  _theory = theory;
  render();
}

// ── Event handlers ────────────────────────────────────────────────────

function onDrop(e) {
  e.preventDefault();
  const type = e.dataTransfer.getData('node-type');
  if (!type) return;

  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  _graph = addNode(_graph, type, x, y);
  emit();
}

function onNodeClick(e, nodeId) {
  e.stopPropagation();
  if (_justDragged) {
    _justDragged = false;
    return;
  }

  if (_selectedNodeId === null) {
    _selectedNodeId = nodeId;
    render();
  } else {
    // Connect the two nodes. Clicking the same node again adds a self-loop.
    _graph = addEdge(_graph, _selectedNodeId, nodeId);
    _selectedNodeId = null;
    emit();
  }
}

function onBackgroundClick() {
  _justDragged = false;
  if (_selectedNodeId !== null) {
    _selectedNodeId = null;
    render();
  }
}

function onNodeRightClick(e, nodeId) {
  e.preventDefault();
  _graph = removeNode(_graph, nodeId);
  _selectedNodeId = null;
  emit();
}

function onEdgeRightClick(e, edgeId) {
  e.preventDefault();
  _graph = removeEdge(_graph, edgeId);
  emit();
}

function onNodeMouseDown(e, nodeId) {
  if (e.button !== 0) return;
  e.stopPropagation();
  const node = getNode(_graph, nodeId);
  const svg = document.getElementById('canvas');
  const rect = svg.getBoundingClientRect();
  _dragging = {
    nodeId,
    offsetX: e.clientX - rect.left - node.x,
    offsetY: e.clientY - rect.top - node.y,
    moved: false,
  };
}

function onMouseMove(e) {
  if (!_dragging) return;
  _dragging.moved = true;
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left - _dragging.offsetX;
  const y = e.clientY - rect.top - _dragging.offsetY;
  _graph = updateNodePosition(_graph, _dragging.nodeId, x, y);
  render();
}

function onMouseUp() {
  if (_dragging && _dragging.moved) {
    _justDragged = true;
    emit();
  }
  _dragging = null;
}

// ── Rendering ─────────────────────────────────────────────────────────

function render() {
  renderEdges();
  renderNodes();
}

function renderEdges() {
  EDGE_LAYER.innerHTML = '';

  // Group edges that share the same pair of nodes (or the same self-loop
  // node) so duplicates can be fanned apart instead of drawn on top of
  // each other.
  const groups = new Map();
  for (const edge of _graph.edges) {
    const key = edge.from === edge.to
      ? `self:${edge.from}`
      : `pair:${Math.min(edge.from, edge.to)}:${Math.max(edge.from, edge.to)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(edge);
  }

  for (const group of groups.values()) {
    group.forEach((edge, index) => renderEdge(edge, index, group.length));
  }
}

function renderEdge(edge, index, total) {
  const from = getNode(_graph, edge.from);
  const to = getNode(_graph, edge.to);
  if (!from || !to) return;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', edge.from === edge.to
    ? selfLoopPath(from, index, total)
    : parallelPath(from, to, index, total));
  path.className.baseVal = 'edge-line';

  path.addEventListener('contextmenu', e => onEdgeRightClick(e, edge.id));
  EDGE_LAYER.appendChild(path);
}

// Fans parallel edges between the same two nodes out into a symmetric set
// of curves, e.g. 3 edges become offsets [-1, 0, 1] * PARALLEL_SPACING.
function parallelPath(from, to, index, total) {
  const offset = (index - (total - 1) / 2) * PARALLEL_SPACING;
  if (offset === 0) {
    return `M ${from.x},${from.y} L ${to.x},${to.y}`;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const mx = (from.x + to.x) / 2 + nx * offset;
  const my = (from.y + to.y) / 2 + ny * offset;
  return `M ${from.x},${from.y} Q ${mx},${my} ${to.x},${to.y}`;
}

// Draws a self-loop as a small teardrop bulging away from the vertex.
// Multiple self-loops on the same node fan out around it by angle.
function selfLoopPath(node, index, total) {
  const angle = -Math.PI / 2 + (index - (total - 1) / 2) * (Math.PI / 3);
  const cx1 = node.x + Math.cos(angle - LOOP_SPREAD) * LOOP_RADIUS;
  const cy1 = node.y + Math.sin(angle - LOOP_SPREAD) * LOOP_RADIUS;
  const cx2 = node.x + Math.cos(angle + LOOP_SPREAD) * LOOP_RADIUS;
  const cy2 = node.y + Math.sin(angle + LOOP_SPREAD) * LOOP_RADIUS;
  return `M ${node.x},${node.y} C ${cx1},${cy1} ${cx2},${cy2} ${node.x},${node.y}`;
}

function renderNodes() {
  NODE_LAYER.innerHTML = '';
  for (const node of _graph.nodes) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const r = NODE_RADIUS[node.type] ?? 12;
    const legs = countLegs(_graph, node.id);
    const invalid = node.type === 'vertex' && legs !== _theory.legsPerVertex && legs > 0;
    const selected = node.id === _selectedNodeId;

    g.className.baseVal = [
      `node-${node.type}`,
      selected ? 'selected' : '',
      invalid ? 'invalid' : '',
    ].filter(Boolean).join(' ');

    g.setAttribute('transform', `translate(${node.x},${node.y})`);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', r);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.className.baseVal = 'node-label';
    label.textContent = node.type === 'vertex' ? _theory.vertexNodeLabel : '';

    g.append(circle, label);

    g.addEventListener('click', e => onNodeClick(e, node.id));
    g.addEventListener('contextmenu', e => onNodeRightClick(e, node.id));
    g.addEventListener('mousedown', e => onNodeMouseDown(e, node.id));

    NODE_LAYER.appendChild(g);
  }
}

// ── Palette drag init ─────────────────────────────────────────────────

document.querySelectorAll('.palette-item').forEach(el => {
  el.addEventListener('dragstart', e => {
    e.dataTransfer.setData('node-type', el.dataset.type);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────

function emit() {
  render();
  _onGraphChange(_graph);
}
