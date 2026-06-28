// Renders the "Spin-summed |M|²" panel below the simplified-amplitude panel.
// Same quiz-cover behaviour as simplified-panel.js.

import { isRevealed, reveal } from './quiz.js';

const body = document.getElementById('msq-body');

body.addEventListener('click', () => {
  if (!body.classList.contains('covered')) return;
  reveal('msq');
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
    p.textContent = 'Build a QED diagram to see the spin-averaged squared amplitude here.';
    el.appendChild(p);
  });
}

export function renderLoading(firstLoad) {
  setBody(el => {
    const p = document.createElement('p');
    p.className = 'simplified-loading';
    p.textContent = firstLoad
      ? 'Loading symbolic engine (first time only, a few seconds)…'
      : 'Computing |M|²…';
    el.appendChild(p);
  });
}

export function renderResult(latex) {
  setBody(el => {
    const note = document.createElement('p');
    note.className = 'simplified-note';
    note.textContent = 'Spin/polarisation completeness relations applied; traces evaluated analytically.';
    el.appendChild(note);

    const formula = document.createElement('div');
    formula.className = 'simplified-formula';
    try {
      katex.render(latex, formula, { throwOnError: false, displayMode: true });
    } catch {
      formula.textContent = latex;
    }
    el.appendChild(formula);
    el.classList.toggle('covered', !isRevealed('msq'));
  });
}

export function renderLoop() {
  setBody(el => {
    const p = document.createElement('p');
    p.className = 'simplified-note';
    p.textContent =
      'This diagram has a fermion loop. The loop integral diverges and requires '
      + 'dimensional regularisation — |M|² cannot be reduced to a finite expression '
      + 'without renormalisation.';
    el.appendChild(p);
  });
}

export function renderUnsupported() {
  setBody(el => {
    const p = document.createElement('p');
    p.className = 'simplified-note';
    p.textContent =
      'Spin-summed |M|² is shown for QED tree-level diagrams with two vertices. '
      + 'Add more vertices or switch to a QED diagram to see it here.';
    el.appendChild(p);
  });
}

export function renderUnavailable() {
  setBody(el => {
    const p = document.createElement('p');
    p.className = 'simplified-note';
    p.textContent = 'Symbolic engine unavailable (offline or blocked).';
    el.appendChild(p);
  });
}

export function refreshCover() {
  const hasFormula = !!body.querySelector('.simplified-formula');
  body.classList.toggle('covered', hasFormula && !isRevealed('msq'));
}
