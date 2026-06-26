import { addNode, addEdge, removeNode, removeEdge, flipEdge, updateNodePosition, getNode, countLegs, countLegsByType, isVertexNode } from './graph.js';
import { wavyPathD } from './wavy.js';
import { NODE_RADIUS } from './constants.js';
import { routeMomenta } from './momentum.js';
import { isRevealed } from './quiz.js';

const EDGE_LAYER = document.getElementById('edges-layer');
const NODE_LAYER = document.getElementById('nodes-layer');
const MARQUEE_LAYER = document.getElementById('marquee-layer');
const CONTENT_LAYER = document.getElementById('content-layer');
const SVG_EL = document.getElementById('canvas');

const PARALLEL_SPACING = 16;     // px between fanned-out lines sharing a node pair
const LOOP_RADIUS = 80;          // how far a self-loop bulges from its vertex
const LOOP_SPREAD = Math.PI / 6; // angular half-width of a self-loop's neck
const LABEL_MARGIN = 14;         // extra px beyond the line/loop where its momentum label sits

let _graph = null;
let _theory = null;
let _onGraphChange = null;
let _drawEdgeType = 'scalar';
let _selectedNodeId = null; // single node picked for the click-to-connect gesture
let _selectedNodeIds = new Set(); // marquee/group selection, for moving several nodes together
let _dragging = null; // { startX, startY, startPositions: [{id,x,y}], moved }
let _marquee = null; // { startX, startY, x, y }, in logical (pan-adjusted) coordinates
let _panning = null; // { lastClientX, lastClientY } while Space+drag-panning
let _panX = 0; // CONTENT_LAYER's translate offset -- an infinite canvas, not scroll-bound
let _panY = 0;
let _spaceHeld = false;
let _justDragged = false; // suppresses the click that follows a drag release

// ── Public API ────────────────────────────────────────────────────────

export function initCanvas (svgEl, graph, theory, onGraphChange) {
  _graph = graph;
  _theory = theory;
  _onGraphChange = onGraphChange;

  // Drop from palette
  svgEl.addEventListener('dragover', e => e.preventDefault());
  svgEl.addEventListener('drop', onDrop);

  // Drag-to-reposition, marquee-select, and Space-drag-to-pan all start as a
  // plain mousedown on empty canvas (node mousedown stops propagation before
  // it gets here) and are disambiguated in onBackgroundMouseDown.
  svgEl.addEventListener('mousedown', onBackgroundMouseDown);
  svgEl.addEventListener('mousemove', onMouseMove);
  svgEl.addEventListener('mouseup', onMouseUp);

  // Clicking empty canvas cancels a pending node selection
  svgEl.addEventListener('click', onBackgroundClick);

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  render();
}

export function updateGraph (graph) {
  _graph = graph;
  _selectedNodeId = null;
  _selectedNodeIds = new Set();
  _dragging = null;
  setPan(0, 0); // start a freshly loaded/cleared diagram centred at the origin
  render();
}

export function setTheory (theory) {
  _theory = theory;
  render();
}

// Forces a redraw after a quiz-state change that isn't itself a graph edit
// (canvas has no other way to learn that quiz state changed).
export function refresh () {
  render();
}

export function setDrawEdgeType (type) {
  _drawEdgeType = type;
}

// Rebuilds the palette from the current theory's paletteItems list.
// Called by app.js whenever the theory changes.
export function rebuildPalette (theory) {
  const container = document.getElementById('palette-items');
  container.innerHTML = '';

  if (theory.supportsEdgeTypes) {
    const heading = document.createElement('p');
    heading.className = 'palette-heading';
    heading.textContent = 'Edge type';
    container.appendChild(heading);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'draw-mode-palette-group';
    const defaultType = theory.defaultDrawEdgeType ?? 'fermion';
    _drawEdgeType = defaultType;

    for (const type of ['fermion', 'photon']) {
      const btn = document.createElement('button');
      btn.className = 'draw-mode-palette-btn';
      btn.dataset.edgeType = type;
      btn.textContent = type === 'fermion' ? 'Fermion' : 'Photon';
      btn.setAttribute('aria-pressed', String(type === defaultType));
      if (type === defaultType) btn.classList.add('active');
      btn.addEventListener('click', () => {
        _drawEdgeType = type;
        btnGroup.querySelectorAll('.draw-mode-palette-btn').forEach(b => {
          const active = b.dataset.edgeType === type;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', String(active));
        });
      });
      btnGroup.appendChild(btn);
    }

    container.appendChild(btnGroup);
    const divider = document.createElement('hr');
    divider.className = 'palette-divider';
    container.appendChild(divider);
  } else {
    _drawEdgeType = 'scalar';
  }

  for (const item of (theory.paletteItems ?? [])) {
    const factorText = item.factorText ?? resolveKey(theory, item.factorKey) ?? '';
    const div = document.createElement('div');
    div.className = 'palette-item';
    div.draggable = true;
    div.dataset.type = item.type;
    div.title = 'Drag onto canvas';
    div.innerHTML = paletteIconSVG(item.type) +
      `<span>${item.label}<br /><small>${factorText}</small></span>`;
    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('node-type', item.type);
    });
    container.appendChild(div);
  }
}

function resolveKey (obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function paletteIconSVG (type) {
  const open = '<svg width="32" height="32" viewBox="0 0 32 32">';
  const close = '</svg>';
  switch (type) {
    case 'vertex':
    case 'qed-vertex':
      return open + '<circle cx="16" cy="16" r="10" fill="var(--colour-vertex)" />' + close;
    case 'external':
    case 'fermion-ext':
      return open + '<circle cx="16" cy="16" r="8" fill="none" stroke="var(--colour-external)" stroke-width="2.5" />' + close;
    case 'photon-ext':
      return open +
        '<circle cx="16" cy="16" r="8" fill="none" stroke="var(--colour-photon, #0891b2)" stroke-width="2" />' +
        '<path d="M 8,16 Q 10,12 12,16 Q 14,20 16,16 Q 18,12 20,16 Q 22,20 24,16" fill="none" stroke="var(--colour-photon, #0891b2)" stroke-width="1.5" />' +
        close;
    default:
      return open + '<circle cx="16" cy="16" r="8" fill="var(--colour-vertex)" />' + close;
  }
}

// ── Event handlers ────────────────────────────────────────────────────

function onDrop (e) {
  e.preventDefault();
  const type = e.dataTransfer.getData('node-type');
  if (!type) return;

  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left - _panX;
  const y = e.clientY - rect.top - _panY;

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
    _graph = addEdge(_graph, _selectedNodeId, nodeId, _drawEdgeType);
    _selectedNodeId = null;
    emit();
  }
}

function onBackgroundClick () {
  // A click always fires right after mouseup, even after a real drag -- this
  // is the same phantom-click suppression onNodeClick already needed for
  // node-dragging, just also covering the marquee's background-click case.
  if (_justDragged) {
    _justDragged = false;
    return;
  }
  if (_selectedNodeId !== null || _selectedNodeIds.size > 0) {
    _selectedNodeId = null;
    _selectedNodeIds = new Set();
    render();
  }
}

function onBackgroundMouseDown (e) {
  if (e.button !== 0) return;
  const rect = SVG_EL.getBoundingClientRect();

  if (_spaceHeld) {
    _panning = { lastClientX: e.clientX, lastClientY: e.clientY };
    SVG_EL.classList.add('panning');
    return;
  }

  const x = e.clientX - rect.left - _panX;
  const y = e.clientY - rect.top - _panY;
  _marquee = { startX: x, startY: y, x, y };
}

function setPan (x, y) {
  _panX = x;
  _panY = y;
  CONTENT_LAYER.setAttribute('transform', `translate(${_panX},${_panY})`);
}

function onKeyDown (e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

  if (e.code === 'Space') {
    e.preventDefault(); // stop the browser's default page-scroll-on-space
    if (!_spaceHeld) {
      _spaceHeld = true;
      SVG_EL.classList.add('space-held');
    }
  } else if (e.code === 'Escape') {
    clearSelection();
  }
}

function onKeyUp (e) {
  if (e.code === 'Space') {
    _spaceHeld = false;
    SVG_EL.classList.remove('space-held');
  }
}

function clearSelection () {
  if (_selectedNodeId === null && _selectedNodeIds.size === 0) return;
  _selectedNodeId = null;
  _selectedNodeIds = new Set();
  render();
}

function onNodeRightClick (e, nodeId) {
  e.preventDefault();
  _graph = removeNode(_graph, nodeId);
  _selectedNodeId = null;
  _selectedNodeIds.delete(nodeId);
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
  const rect = SVG_EL.getBoundingClientRect();

  // Dragging a node that's part of a multi-selection moves the whole group;
  // otherwise it's just that one node, same as before.
  const groupIds = _selectedNodeIds.has(nodeId) && _selectedNodeIds.size > 1
    ? [..._selectedNodeIds]
    : [nodeId];

  _dragging = {
    startX: e.clientX - rect.left,
    startY: e.clientY - rect.top,
    startPositions: groupIds.map(id => {
      const n = getNode(_graph, id);
      return { id, x: n.x, y: n.y };
    }),
    moved: false,
  };
}

function onMouseMove (e) {
  if (_panning) {
    const dx = e.clientX - _panning.lastClientX;
    const dy = e.clientY - _panning.lastClientY;
    _panning.lastClientX = e.clientX;
    _panning.lastClientY = e.clientY;
    setPan(_panX + dx, _panY + dy);
    return;
  }

  if (_marquee) {
    const rect = SVG_EL.getBoundingClientRect();
    _marquee.x = e.clientX - rect.left - _panX;
    _marquee.y = e.clientY - rect.top - _panY;
    updateMarqueeSelection();
    renderMarquee();
    renderNodes();
    return;
  }

  if (!_dragging) return;
  _dragging.moved = true;
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const dx = x - _dragging.startX;
  const dy = y - _dragging.startY;
  let next = _graph;
  for (const pos of _dragging.startPositions) {
    next = updateNodePosition(next, pos.id, pos.x + dx, pos.y + dy);
  }
  _graph = next;
  render();
}

function onMouseUp () {
  if (_panning) {
    _panning = null;
    SVG_EL.classList.remove('panning');
    return;
  }

  if (_marquee) {
    finishMarquee();
    return;
  }

  if (_dragging && _dragging.moved) {
    _justDragged = true;
    emit();
  }
  _dragging = null;
}

// Selects every node whose centre falls within the current marquee box.
function updateMarqueeSelection () {
  const minX = Math.min(_marquee.startX, _marquee.x);
  const maxX = Math.max(_marquee.startX, _marquee.x);
  const minY = Math.min(_marquee.startY, _marquee.y);
  const maxY = Math.max(_marquee.startY, _marquee.y);
  _selectedNodeIds = new Set(
    _graph.nodes
      .filter(n => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
      .map(n => n.id)
  );
}

function finishMarquee () {
  const dragged = Math.hypot(_marquee.x - _marquee.startX, _marquee.y - _marquee.startY) > 4;
  if (dragged) {
    _justDragged = true; // suppress the click that's about to follow this drag
  } else {
    _selectedNodeIds = new Set(); // a plain click, not a real drag -- clear instead
  }
  _marquee = null;
  MARQUEE_LAYER.innerHTML = '';
  renderNodes();
}

function renderMarquee () {
  MARQUEE_LAYER.innerHTML = '';
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', Math.min(_marquee.startX, _marquee.x));
  rect.setAttribute('y', Math.min(_marquee.startY, _marquee.y));
  rect.setAttribute('width', Math.abs(_marquee.x - _marquee.startX));
  rect.setAttribute('height', Math.abs(_marquee.y - _marquee.startY));
  rect.className.baseVal = 'marquee-box';
  MARQUEE_LAYER.appendChild(rect);
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
  const isPhoton = edge.edgeType === 'photon';
  const geom = isSelfLoop
    ? selfLoopGeometry(from, index, total)
    : parallelGeometry(from, to, index, total);

  // Photon propagators use a wavy path along the straight start→end segment;
  // self-loop photons keep the Bézier shape (rare in QED but still drawable).
  const pathD = (isPhoton && !isSelfLoop)
    ? wavyPathD(geom.start, geom.end)
    : geom.d;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  if (!isPhoton) path.setAttribute('marker-end', 'url(#arrowhead)');
  path.className.baseVal = isPhoton ? 'edge-line edge-line--photon' : 'edge-line';

  path.addEventListener('contextmenu', e => onEdgeRightClick(e, edge.id));
  path.addEventListener('click', e => onEdgeClick(e, edge.id));
  EDGE_LAYER.appendChild(path);

  const labelText = isRevealed('momentum') ? formatMomentumExpr(momentum) : '';
  if (labelText) {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', geom.labelPos.x);
    label.setAttribute('y', geom.labelPos.y);
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
      start, end,
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
    start, end,
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
    let invalid = false;
    if (isVertexNode(node) && legs > 0) {
      if (typeof _theory.legsPerVertex === 'number') {
        invalid = legs !== _theory.legsPerVertex;
      } else {
        const byType = countLegsByType(_graph, node.id);
        invalid = Object.entries(_theory.legsPerVertex.byType)
          .some(([t, n]) => byType[t] !== n);
      }
    }
    const selected = node.id === _selectedNodeId;
    const groupSelected = _selectedNodeIds.has(node.id);

    g.className.baseVal = [
      `node-${node.type}`,
      selected ? 'selected' : '',
      groupSelected ? 'group-selected' : '',
      invalid ? 'invalid' : '',
    ].filter(Boolean).join(' ');

    g.setAttribute('transform', `translate(${node.x},${node.y})`);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', r);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.className.baseVal = 'node-label';
    label.textContent = isVertexNode(node) ? _theory.vertexNodeLabel : '';

    g.append(circle, label);

    if (node.type === 'photon-ext') {
      const wave = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      wave.setAttribute('d', 'M -7,0 Q -5,-3.5 -3,0 Q -1,3.5 1,0 Q 3,-3.5 5,0 Q 7,3.5 9,0');
      wave.className.baseVal = 'photon-node-wave';
      g.appendChild(wave);
    }

    g.addEventListener('click', e => onNodeClick(e, node.id));
    g.addEventListener('contextmenu', e => onNodeRightClick(e, node.id));
    g.addEventListener('mousedown', e => onNodeMouseDown(e, node.id));

    NODE_LAYER.appendChild(g);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function emit () {
  render();
  _onGraphChange(_graph);
}
