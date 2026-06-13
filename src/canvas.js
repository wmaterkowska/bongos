import { addNode, addEdge, removeNode, removeEdge, updateNodePosition, getNode, countLegs } from './graph.js';
import { NODE_RADIUS, THEORY } from './constants.js';

const EDGE_LAYER = document.getElementById('edges-layer');
const NODE_LAYER = document.getElementById('nodes-layer');

let _graph = null;
let _onGraphChange = null;
let _selectedNodeId = null;
let _dragging = null; // { nodeId, offsetX, offsetY }

// ── Public API ────────────────────────────────────────────────────────

export function initCanvas(svgEl, graph, onGraphChange) {
  _graph = graph;
  _onGraphChange = onGraphChange;

  // Drop from palette
  svgEl.addEventListener('dragover', e => e.preventDefault());
  svgEl.addEventListener('drop', onDrop);

  // Drag-to-reposition
  svgEl.addEventListener('mousemove', onMouseMove);
  svgEl.addEventListener('mouseup', onMouseUp);

  render();
}

export function updateGraph(graph) {
  _graph = graph;
  _selectedNodeId = null;
  _dragging = null;
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

function onNodeClick(nodeId) {
  if (_dragging) return; // ignore click at end of drag

  if (_selectedNodeId === null) {
    _selectedNodeId = nodeId;
    render();
  } else if (_selectedNodeId === nodeId) {
    _selectedNodeId = null;
    render();
  } else {
    // Connect the two nodes
    _graph = addEdge(_graph, _selectedNodeId, nodeId);
    _selectedNodeId = null;
    emit();
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
  for (const edge of _graph.edges) {
    const from = getNode(_graph, edge.from);
    const to = getNode(_graph, edge.to);
    if (!from || !to) continue;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', from.x);
    line.setAttribute('y1', from.y);
    line.setAttribute('x2', to.x);
    line.setAttribute('y2', to.y);
    line.className.baseVal = 'edge-line';

    line.addEventListener('contextmenu', e => onEdgeRightClick(e, edge.id));
    EDGE_LAYER.appendChild(line);
  }
}

function renderNodes() {
  NODE_LAYER.innerHTML = '';
  for (const node of _graph.nodes) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const r = NODE_RADIUS[node.type] ?? 12;
    const legs = countLegs(_graph, node.id);
    const invalid = node.type === 'vertex' && legs !== THEORY.legsPerVertex && legs > 0;
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
    label.textContent = node.type === 'vertex' ? 'λ' : '';

    g.append(circle, label);

    g.addEventListener('click', () => onNodeClick(node.id));
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
