import { createGraph, loadFromJSON, addNode, addEdge } from './src/graph.js';
import { initCanvas, updateGraph, setTheory as setCanvasTheory } from './src/canvas.js';
import { analyseGraph, buildContributions } from './src/rules.js';
import { computeSymmetryFactor } from './src/symmetry.js';
import { renderOutput } from './src/output.js';
import { THEORIES, DEFAULT_THEORY_ID } from './src/constants.js';
import { simplifyAmplitude } from './src/sympy-bridge.js';

let graph = createGraph();
let theory = THEORIES[DEFAULT_THEORY_ID];

function onGraphChange(newGraph) {
  graph = newGraph;
  const analysis = analyseGraph(graph, theory);
  const symFactor = computeSymmetryFactor(graph, analysis);
  const contributions = graph.nodes.length > 0
    ? buildContributions(analysis, symFactor, theory)
    : [];
  renderOutput(contributions, analysis.warnings);
}

function updateTheoryChrome() {
  document.title = `Feynman Diagram Builder — ${theory.name}`;
  document.getElementById('vertex-factor-label').textContent = theory.coupling.displaySymbol;
}

// ── Toolbar: theory select ───────────────────────────────────────────────
// Options are generated from the THEORIES registry, so adding a theory in
// src/constants.js is enough to make it selectable — no markup changes needed.
const theorySelect = document.getElementById('theory-select');
for (const t of Object.values(THEORIES)) {
  const option = document.createElement('option');
  option.value = t.id;
  option.textContent = t.name;
  theorySelect.appendChild(option);
}
theorySelect.value = theory.id;
theorySelect.addEventListener('change', e => {
  theory = THEORIES[e.target.value];
  updateTheoryChrome();
  setCanvasTheory(theory);
  onGraphChange(graph);
});

updateTheoryChrome();

// Initialise canvas with the empty graph
initCanvas(document.getElementById('canvas'), graph, theory, onGraphChange);

// ── Toolbar: clear ────────────────────────────────────────────────────
document.getElementById('btn-clear').addEventListener('click', () => {
  graph = createGraph();
  updateGraph(graph);
  onGraphChange(graph);
});

// ── Toolbar: load example ─────────────────────────────────────────────
document.getElementById('example-select').addEventListener('change', async e => {
  const path = e.target.value;
  if (!path) return;
  e.target.value = '';

  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    graph = loadFromJSON(json);
    updateGraph(graph);
    onGraphChange(graph);
  } catch (err) {
    console.error('Failed to load example:', err);
  }
});

// ── Temporary Step 3 smoke test for src/sympy-bridge.js ────────────────
// Builds the tadpole diagram in memory (without touching the visible graph
// or canvas) and runs it through the full routeMomenta -> JSON -> Python ->
// sympy.latex pipeline, so the result can be checked against the known-good
// value already verified in py/test_simplify.py: \frac{\lambda}{2\left(k_{1}^{2} - m^{2}\right)}
// Remove once Step 4 wires real simplification into the output panel.
{
  let tadpole = createGraph();
  tadpole = addNode(tadpole, 'vertex', 0, 0);
  tadpole = addNode(tadpole, 'external', -10, 0);
  tadpole = addNode(tadpole, 'external', 10, 0);
  const [vertex, ext1, ext2] = tadpole.nodes;
  tadpole = addEdge(tadpole, ext1.id, vertex.id);
  tadpole = addEdge(tadpole, ext2.id, vertex.id);
  tadpole = addEdge(tadpole, vertex.id, vertex.id);

  simplifyAmplitude(tadpole, 2)
    .then(latex => console.log('[sympy-bridge] tadpole simplified amplitude:', latex))
    .catch(err => console.error('[sympy-bridge] failed to load/simplify:', err));
}
