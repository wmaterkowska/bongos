// Renders the "Simplified amplitude" panel under the canvas. This module
// only owns that panel's loading/result/fallback states — the actual SymPy
// computation lives in src/sympy-bridge.js.

import { isRevealed, reveal } from './quiz.js';

const body = document.getElementById('simplified-body');

// Attached once, not per-render: this panel's content is intentionally not
// rebuilt on a quiz-mode toggle (see refreshCover() below), so a listener
// re-created inside renderResult() wouldn't survive being re-covered later.
body.addEventListener('click', () => {
  if (!body.classList.contains('covered')) return;
  reveal('simplified');
  body.classList.remove('covered');
});

function setBody(build) {
  body.innerHTML = '';
  body.classList.remove('covered');
  build(body);
}

export function renderPlaceholder() {
  setBody(el => {
    const p = document.createElement('p');
    p.className = 'simplified-placeholder';
    p.textContent = 'Add vertices and connect them to see the simplified amplitude here.';
    el.appendChild(p);
  });
}

export function renderLoading(firstLoad) {
  setBody(el => {
    const p = document.createElement('p');
    p.className = 'simplified-loading';
    p.textContent = firstLoad
      ? 'Loading symbolic engine (first time only, a few seconds)…'
      : 'Simplifying…';
    el.appendChild(p);
  });
}

export function renderResult(latex) {
  setBody(el => {
    const formula = document.createElement('div');
    formula.className = 'simplified-formula';
    try {
      katex.render(latex, formula, { throwOnError: false, displayMode: true });
    } catch {
      formula.textContent = latex;
    }
    el.appendChild(formula);
    el.classList.toggle('covered', !isRevealed('simplified'));
  });
}

// Used only by the quiz-mode toggle: flips the covered class on whatever is
// already rendered, without recomputing the simplification (a Pyodide/SymPy
// round-trip) just because the cover state changed.
export function refreshCover() {
  const hasFormula = !!body.querySelector('.simplified-formula');
  body.classList.toggle('covered', hasFormula && !isRevealed('simplified'));
}

export function renderUnavailable() {
  setBody(el => {
    const p = document.createElement('p');
    p.className = 'simplified-note';
    p.textContent = 'Symbolic engine unavailable (offline or blocked) — see the unsimplified combined amplitude in the panel on the right instead.';
    el.appendChild(p);
  });
}
