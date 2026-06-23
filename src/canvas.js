import { addNode, addEdge, removeNode, removeEdge, flipEdge, updateNodePosition, getNode, countLegs } from './graph.js';
import { NODE_RADIUS } from './constants.js';
import { routeMomenta } from './momentum.js';

const EDGE_LAYER = document.getElementById('edges-layer');
const NODE_LAYER = document.getElementById('nodes-layer');

const PARALLEL_SPACING = 16;     // px between fanned-out lines sharing a node pair
const LOOP_RADIUS = 80;          // how far a self-loop bulges from its vertex
const LOOP_SPREAD = Math.PI / 6; // angular half-width of a self-loop's neck
const LABEL_MARGIN = 14;         // extra px beyond the line/loop where its momentum label sits

let _graph = null;
let _theory = null;
let _onGraphChange = null;
let _selectedNodeId = null;
let _dragging = null; // { nodeId, offsetX, offsetY, moved }
let _justDragged = false; // suppresses the click that follows a drag release

// ── Public API ────────────────────────────────────────────────────────

export function initCanvas (svgEl, graph, theory, onGraphChange) {
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

export function updateGraph (graph) {
  _graph = graph;
  _selectedNodeId = null;
  _dragging = null;
  render();
}

export function setTheory (theory) {
  _theory = theory;
  render();
}

// ── Event handlers ────────────────────────────────────────────────────

function onDrop (e) {
  e.preventDefault();
  const type = e.dataTransfer.getData('node-type');
  if (!type) return;

  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  _graph = addNode(_graph, type, x, y);
  emit();
}

function onNodeClick (e, nodeId) {
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

function onBackgroundClick () {
  _justDragged = false;
  if (_selectedNodeId !== null) {
    _selectedNodeId = null;
    render();
  }
}

function onNodeRightClick (e, nodeId) {
  e.preventDefault();
  _graph = removeNode(_graph, nodeId);
  _selectedNodeId = null;
  emit();
}

function onEdgeRightClick (e, edgeId) {
  e.preventDefault();
  _graph = removeEdge(_graph, edgeId);
  emit();
}

function onEdgeClick (e, edgeId) {
  e.stopPropagation();
  _graph = flipEdge(_graph, edgeId);
  emit();
}

function onNodeMouseDown (e, nodeId) {
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

function onMouseMove (e) {
  if (!_dragging) return;
  _dragging.moved = true;
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left - _dragging.offsetX;
  const y = e.clientY - rect.top - _dragging.offsetY;
  _graph = updateNodePosition(_graph, _dragging.nodeId, x, y);
  render();
}

function onMouseUp () {
  if (_dragging && _dragging.moved) {
    _justDragged = true;
    emit();
  }
  _dragging = null;
}

// ── Rendering ─────────────────────────────────────────────────────────

function render () {
  renderEdges();
  renderNodes();
}

function renderEdges () {
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

  const momenta = routeMomenta(_graph);
  for (const group of groups.values()) {
    group.forEach((edge, index) => renderEdge(edge, index, group.length, momenta.get(edge.id)));
  }
}

function renderEdge (edge, index, total, momentum) {
  const from = getNode(_graph, edge.from);
  const to = getNode(_graph, edge.to);
  if (!from || !to) return;

  const isSelfLoop = edge.from === edge.to;
  const { d, labelPos } = isSelfLoop
    ? selfLoopGeometry(from, index, total)
    : parallelGeometry(from, to, index, total);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('marker-end', 'url(#arrowhead)');
  path.className.baseVal = 'edge-line';

  path.addEventListener('contextmenu', e => onEdgeRightClick(e, edge.id));
  path.addEventListener('click', e => onEdgeClick(e, edge.id));
  EDGE_LAYER.appendChild(path);

  const labelText = formatMomentumExpr(momentum);
  if (labelText) {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', labelPos.x);
    label.setAttribute('y', labelPos.y);
    label.className.baseVal = 'edge-momentum-label';
    label.textContent = labelText;
    EDGE_LAYER.appendChild(label);
  }
}

// Fans parallel edges between the same two nodes out into a symmetric set of
// curves, e.g. 3 edges become offsets [-1, 0, 1] * PARALLEL_SPACING. Endpoints
// are trimmed back to each node's boundary (rather than its centre) so the
// arrowhead marker lands just outside the circle instead of underneath it.
function parallelGeometry (from, to, index, total) {
  const offset = (index - (total - 1) / 2) * PARALLEL_SPACING;
  const rFrom = NODE_RADIUS[from.type] ?? 12;
  const rTo = NODE_RADIUS[to.type] ?? 12;

  if (offset === 0) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length, uy = dy / length;
    const start = { x: from.x + ux * rFrom, y: from.y + uy * rFrom };
    const end = { x: to.x - ux * rTo, y: to.y - uy * rTo };
    const nx = -uy, ny = ux;
    return {
      d: `M ${start.x},${start.y} L ${end.x},${end.y}`,
      labelPos: {
        x: (from.x + to.x) / 2 + nx * LABEL_MARGIN,
        y: (from.y + to.y) / 2 + ny * LABEL_MARGIN,
      },
    };
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const control = {
    x: (from.x + to.x) / 2 + nx * offset,
    y: (from.y + to.y) / 2 + ny * offset,
  };

  // Trim each endpoint along its tangent direction (start -> control,
  // control -> end) by that node's radius — a close approximation of the
  // true curve/circle intersection, good enough at this node size.
  const start = trimTowards(from, control, rFrom);
  const end = trimTowards(to, control, rTo);

  const labelDir = Math.sign(offset);
  return {
    d: `M ${start.x},${start.y} Q ${control.x},${control.y} ${end.x},${end.y}`,
    labelPos: {
      x: (from.x + to.x) / 2 + nx * (offset + labelDir * LABEL_MARGIN),
      y: (from.y + to.y) / 2 + ny * (offset + labelDir * LABEL_MARGIN),
    },
  };
}

// Draws a self-loop as a small teardrop bulging away from the vertex.
// Multiple self-loops on the same node fan out around it by angle. The loop
// starts/ends just outside the node's boundary, not at its centre, for the
// same arrowhead-visibility reason as parallelGeometry.
function selfLoopGeometry (node, index, total) {
  const angle = -Math.PI / 2 + (index - (total - 1) / 2) * (Math.PI / 3);
  const r = NODE_RADIUS[node.type] ?? 12;
  const c1 = {
    x: node.x + Math.cos(angle - LOOP_SPREAD) * LOOP_RADIUS,
    y: node.y + Math.sin(angle - LOOP_SPREAD) * LOOP_RADIUS,
  };
  const c2 = {
    x: node.x + Math.cos(angle + LOOP_SPREAD) * LOOP_RADIUS,
    y: node.y + Math.sin(angle + LOOP_SPREAD) * LOOP_RADIUS,
  };
  const start = trimTowards(node, c1, r);
  const end = trimTowards(node, c2, r);
  return {
    d: `M ${start.x},${start.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`,
    labelPos: {
      x: node.x + Math.cos(angle) * (LOOP_RADIUS + LABEL_MARGIN),
      y: node.y + Math.sin(angle) * (LOOP_RADIUS + LABEL_MARGIN),
    },
  };
}

// Moves `point` toward `target` by distance `dist` — used to pull a path's
// endpoint off a node's centre and onto its boundary along its tangent.
function trimTowards (point, target, dist) {
  const dx = target.x - point.x;
  const dy = target.y - point.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: point.x + (dx / length) * dist, y: point.y + (dy / length) * dist };
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

// Renders a MomentumExpr's symbols (e.g. "p_{1}") with proper subscripts
// (e.g. "p₁") for the lightweight SVG <text> labels on the canvas — full
// KaTeX is reserved for the output panel's HTML cards.
function formatMomentumExpr (expr) {
  if (!expr || expr.terms.length === 0) return '';
  return expr.terms
    .map(({ sign, symbol }) => ({
      sign,
      rendered: symbol.replace(/_\{(\d+)\}/, (_, digits) =>
        [...digits].map(d => SUBSCRIPT_DIGITS[+d]).join('')
      ),
    }))
    .map(({ sign, rendered }, i) => {
      if (i === 0) return sign < 0 ? `-${rendered}` : rendered;
      return sign < 0 ? ` − ${rendered}` : ` + ${rendered}`;
    })
    .join('');
}

function renderNodes () {
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

function emit () {
  render();
  _onGraphChange(_graph);
}
