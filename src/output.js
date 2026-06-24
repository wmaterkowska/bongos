// Renders the step-by-step Feynman factors into the right panel.
// Depends on KaTeX being available as a global (loaded via <script> in index.html).

import { isRevealed, reveal } from './quiz.js';

const body = document.getElementById('output-body');

function renderKaTeX(latex, el) {
  try {
    katex.render(latex, el, { throwOnError: false, displayMode: true });
  } catch {
    el.textContent = latex;
  }
}

function makeCard(contrib, onReveal) {
  const card = document.createElement('div');
  card.className = 'contrib-card' + (contrib.id === 'combined' ? ' combined' : '');

  const header = document.createElement('div');
  header.className = 'contrib-header';

  const dot = document.createElement('span');
  dot.className = 'contrib-dot';
  dot.style.background = contrib.colour ?? '#64748b';

  const label = document.createElement('span');
  label.textContent = contrib.label + (contrib.count != null ? ` ×${contrib.count}` : '');

  header.append(dot, label);

  const formula = document.createElement('div');
  formula.className = 'contrib-formula';
  renderKaTeX(contrib.latex, formula);

  const desc = document.createElement('p');
  desc.className = 'contrib-desc';
  desc.textContent = contrib.description;

  card.append(header, formula, desc);

  // Quiz mode: cards are rebuilt from scratch on every renderOutput() call,
  // so a fresh one-shot listener per card is correct -- there's no persistent
  // card DOM that needs re-covering later without a rebuild.
  if (!isRevealed(contrib.id)) {
    card.classList.add('covered');
    card.addEventListener('click', () => {
      reveal(contrib.id);
      card.classList.remove('covered');
      onReveal?.(contrib.id);
    }, { once: true });
  }

  return card;
}

function makeWarningCard(text) {
  const card = document.createElement('div');
  card.className = 'contrib-card warning';
  card.textContent = `⚠ ${text}`;
  return card;
}

export function renderOutput(contributions, warnings, onReveal) {
  body.innerHTML = '';

  if (contributions.length === 0 && warnings.length === 0) {
    const p = document.createElement('p');
    p.className = 'output-placeholder';
    p.textContent = 'Add vertices and connect them to see the amplitude factors here.';
    body.appendChild(p);
    return;
  }

  for (const w of warnings) {
    body.appendChild(makeWarningCard(w));
  }

  for (const contrib of contributions) {
    body.appendChild(makeCard(contrib, onReveal));
  }

  // Combined amplitude card
  if (contributions.length > 0) {
    const combined = contributions.map(c => `\\left[${c.latex}\\right]`).join('');
    body.appendChild(makeCard({
      id: 'combined',
      label: 'Combined amplitude',
      colour: '#4f46e5',
      latex: `\\mathcal{M} = ${combined}`,
      description: 'Product of all Feynman rule factors for this diagram.',
    }, onReveal));
  }
}
