import { createGraph, loadFromJSON } from './src/graph.js';
import { initCanvas, updateGraph } from './src/canvas.js';
import { analyseGraph, buildContributions } from './src/rules.js';
import { computeSymmetryFactor } from './src/symmetry.js';
import { renderOutput } from './src/output.js';

let graph = createGraph();

function onGraphChange(newGraph) {
  graph = newGraph;
  const analysis = analyseGraph(graph);
  const symFactor = computeSymmetryFactor(graph, analysis);
  const contributions = graph.nodes.length > 0
    ? buildContributions(analysis, symFactor)
    : [];
  renderOutput(contributions, analysis.warnings);
}

// Initialise canvas with the empty graph
initCanvas(document.getElementById('canvas'), graph, onGraphChange);

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
