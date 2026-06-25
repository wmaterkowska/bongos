import { createGraph, loadFromJSON } from './src/graph.js';
import { initCanvas, updateGraph, setTheory as setCanvasTheory, refresh as refreshCanvas } from './src/canvas.js';
import { analyseGraph, buildContributions } from './src/rules.js';
import { computeSymmetryFactor } from './src/symmetry.js';
import { renderOutput } from './src/output.js';
import { THEORIES, DEFAULT_THEORY_ID } from './src/constants.js';
import { simplifyAmplitude, isPyodideReady } from './src/sympy-bridge.js';
import * as simplifiedPanel from './src/simplified-panel.js';
import * as quiz from './src/quiz.js';

let graph = createGraph();
let theory = THEORIES[DEFAULT_THEORY_ID];
let amplitudeGeneration = 0;

function computeContributions() {
  const analysis = analyseGraph(graph, theory);
  const symFactor = computeSymmetryFactor(graph, analysis);
  const contributions = graph.nodes.length > 0
    ? buildContributions(analysis, symFactor, theory)
    : [];
  return { analysis, symFactor, contributions };
}

function onCardRevealed(id) {
  if (id === 'momentum') refreshCanvas();
}

function onGraphChange(newGraph) {
  graph = newGraph;
  const { analysis, symFactor, contributions } = computeContributions();
  renderOutput(contributions, analysis.warnings, onCardRevealed);
  updateSimplifiedPanel(graph, symFactor);
}

// Used only by the quiz-mode toggle: re-renders cards (cheap) and flips the
// simplified panel's cover class on its existing content, without re-running
// simplifyAmplitude (a Pyodide/SymPy round-trip).
function refreshCardCovers() {
  const { analysis, contributions } = computeContributions();
  renderOutput(contributions, analysis.warnings, onCardRevealed);
  simplifiedPanel.refreshCover();
  refreshCanvas();
}

// Each call gets its own generation number; if the graph changes again
// before this one's simplification resolves, the stale result is dropped
// instead of overwriting whatever the newer call already rendered.
function updateSimplifiedPanel(currentGraph, symFactor) {
  const generation = ++amplitudeGeneration;

  if (currentGraph.nodes.length === 0) {
    simplifiedPanel.renderPlaceholder();
    return;
  }

  simplifiedPanel.renderLoading(!isPyodideReady());
  simplifyAmplitude(currentGraph, symFactor)
    .then(latex => {
      if (generation !== amplitudeGeneration) return;
      simplifiedPanel.renderResult(latex);
    })
    .catch(err => {
      if (generation !== amplitudeGeneration) return;
      console.error('Symbolic simplification unavailable:', err);
      simplifiedPanel.renderUnavailable();
    });
}

function setExampleLabel(name) {
  document.getElementById('canvas-title').textContent = name ? `Example: ${name}` : 'Custom diagram';
}

// Passed to initCanvas as the interactive-edit callback: any direct canvas
// edit (drag, connect, delete...) means the diagram is no longer "just" the
// example it might have started from, so revert the title before handling
// the change normally. Loading an example or clicking Clear call
// onGraphChange directly instead, setting their own label afterwards.
function onCanvasInteraction(newGraph) {
  setExampleLabel(null);
  quiz.setExampleMode(false);
  quiz.coverAll();
  onGraphChange(newGraph);
  refreshCanvas();
}

function repopulateExamples(t) {
  const select = document.getElementById('example-select');
  while (select.options.length > 1) select.remove(1);
  for (const ex of (t.examples ?? [])) {
    const opt = document.createElement('option');
    opt.value = ex.path;
    opt.textContent = ex.label;
    select.appendChild(opt);
  }
}

function updateTheoryChrome() {
  document.title = `Feynman Diagram Builder — ${theory.name}`;
  document.getElementById('vertex-factor-label').textContent = theory.coupling.displaySymbol;
  repopulateExamples(theory);
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
  quiz.coverAll();
  setCanvasTheory(theory);
  onGraphChange(graph);
});

updateTheoryChrome();

// Initialise canvas with the empty graph
initCanvas(document.getElementById('canvas'), graph, theory, onCanvasInteraction);

// ── Toolbar: clear ────────────────────────────────────────────────────
document.getElementById('btn-clear').addEventListener('click', () => {
  quiz.setExampleMode(false);
  quiz.coverAll();
  graph = createGraph();
  updateGraph(graph);
  onGraphChange(graph);
  setExampleLabel(null);
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
    quiz.setExampleMode(true);
    updateGraph(graph);
    onGraphChange(graph);
    setExampleLabel(json.name);
  } catch (err) {
    console.error('Failed to load example:', err);
  }
});

// ── Toolbar: quiz mode ────────────────────────────────────────────────
const quizBtn = document.getElementById('btn-quiz-mode');
quizBtn.addEventListener('click', () => {
  quiz.setQuizMode(!quiz.isQuizMode());
  quizBtn.classList.toggle('active', quiz.isQuizMode());
  quizBtn.setAttribute('aria-pressed', String(quiz.isQuizMode()));
  refreshCardCovers();
});
