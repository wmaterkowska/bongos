// Renders the "Simplified amplitude" panel under the canvas. This module
// only owns that panel's loading/result/fallback states — the actual SymPy
// computation lives in src/sympy-bridge.js.

const body = document.getElementById('simplified-body');

function setBody(build) {
  body.innerHTML = '';
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
  });
}

export function renderUnavailable() {
  setBody(el => {
    const p = document.createElement('p');
    p.className = 'simplified-note';
    p.textContent = 'Symbolic engine unavailable (offline or blocked) — see the unsimplified combined amplitude in the panel on the right instead.';
    el.appendChild(p);
  });
}
