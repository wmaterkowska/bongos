# Bongos

A browser-based, open-source tool for learning Feynman diagram calculations —
draw a diagram, get every Feynman rule factor explained step by step, and
quiz yourself on the result. No install, no build step, no server: open
`index.html` or visit the live page.

**Live app:** https://wmaterkowska.github.io/bongos/

Built for physics students working through perturbative QFT for the first
time, starting with φ⁴ scalar field theory.

## Features

- **Interactive canvas** — drag vertices and external legs from the palette,
  click two nodes to connect them, click the same node twice for a self-loop,
  drag-select and move groups of nodes, hold Space to pan, right-click to
  delete. Vertices with the wrong number of legs are flagged amber.
- **Step-by-step Feynman factors** — vertices, propagators, external legs,
  loop integrals, the symmetry factor, and overall momentum conservation are
  each rendered as their own KaTeX card, plus a combined-amplitude card.
- **Exact symmetry factor for any diagram** — computed directly from the
  diagram's automorphism group (not a lookup table), so it's correct for
  diagrams beyond the textbook examples.
- **Momentum routing** — every internal line gets a momentum label (arrows
  flip on click) derived from conservation at each vertex, with free loop
  momenta on non-tree edges.
- **Symbolic simplification** — the combined amplitude is also simplified
  via SymPy (running in-browser through Pyodide) and shown underneath the
  canvas.
- **Quiz mode** — toggle it on to hide every factor card and momentum label
  behind a blur. Click a card to reveal it; click the symmetry/momentum card
  to also reveal the canvas's momentum labels. Any edit to the diagram, or
  switching theory, covers everything again. Example diagrams always show
  fully revealed.
- **Example diagrams** — tree-level 2→2, the 1-loop bubble correction,
  tadpole, and the 2-loop sunset/sunrise, loadable from the toolbar.

Currently ships with φ⁴ theory only. The theory selector and Feynman-rule
registry (`src/constants.js`) already support adding more (planned: QED,
φ³ — see the roadmap below).

## Running locally

No build step, no dependencies to install.

```sh
git clone https://github.com/wmaterkowska/bongos.git
cd bongos
```

Then open `index.html` directly in a browser, or serve the folder with any
static file server (needed for the example-diagram fetches and the Pyodide
worker to work correctly under `file://` in some browsers), e.g.:

```sh
npx serve .
```

KaTeX is vendored under `lib/katex/`, so diagram building, the rules engine,
and the symmetry/momentum calculations all work fully offline. Symbolic
simplification (the "Simplified amplitude" panel) loads Pyodide + SymPy from
a CDN on first use, so that one feature needs network access at least once
per session; if it's blocked or offline, the app falls back to the
unsimplified combined-amplitude card instead of erroring.

## Running the tests

Pure-logic modules (`src/graph.js`, `src/rules.js`, `src/momentum.js`,
`src/automorphism.js`) have console-assertion test files under `test/`,
runnable directly with Node:

```sh
node test/graph.test.js
node test/rules.test.js
node test/momentum.test.js
node test/automorphism.test.js
```

`py/simplify.py` (the SymPy helper run inside Pyodide) has its own test file,
runnable with a local Python + SymPy install:

```sh
pip install sympy
python py/test_simplify.py
```

## Project structure

```
bongos/
├── index.html, style.css, app.js   # entry point, styling, wiring
├── src/
│   ├── graph.js          # graph data model (pure functions)
│   ├── canvas.js         # SVG drawing, drag & drop, momentum labels
│   ├── rules.js          # Feynman rules engine
│   ├── symmetry.js       # symmetry factor (delegates to automorphism.js)
│   ├── automorphism.js   # exact symmetry factor via graph automorphism
│   ├── momentum.js       # momentum routing (spanning tree + loop momenta)
│   ├── output.js         # right-panel factor cards
│   ├── simplified-panel.js, sympy-bridge.js  # Pyodide/SymPy simplification
│   ├── quiz.js           # quiz mode cover/reveal state
│   └── constants.js      # theory registry (vertex/propagator/leg rules)
├── py/simplify.py         # SymPy helper run inside Pyodide
├── examples/              # example diagram JSON files
└── test/                  # console-assertion unit tests
```

## Roadmap

This is being built incrementally. Rough shape:

- **v1** — core builder (shipped)
- **v2** — symbolic simplification, momentum routing, exact symmetry factor,
  quiz mode (this release)
- **v3** — additional theories (QED, φ³) via the existing theory registry
- **v4** — derive Feynman rules from a user-entered Lagrangian
- **v5** — native mobile port (optional)

## Contributing

Bug fixes and new example diagrams are welcome. Adding a new theory is meant
to be straightforward: add an entry to `THEORIES` in `src/constants.js`
(vertex factor, propagator, external leg, legs-per-vertex) — the toolbar
selector, rules engine, and canvas pick it up automatically.

## License

[GNU GPLv3](LICENSE).
