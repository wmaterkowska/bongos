import { createGraph, loadFromJSON } from './src/graph.js';
import { initCanvas, updateGraph, setTheory as setCanvasTheory } from './src/canvas.js';
import { analyseGraph, buildContributions } from './src/rules.js';
import { computeSymmetryFactor } from './src/symmetry.js';
import { renderOutput } from './src/output.js';
import { THEORIES, DEFAULT_THEORY_ID } from './src/constants.js';

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
