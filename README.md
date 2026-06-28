# Bongos

A browser-based, open-source tool for learning Feynman diagram calculations —
draw a diagram, get every Feynman rule factor explained step by step, and
quiz yourself on the result. No install, no build step, no server: open
`index.html` or visit the live page.

**Live app:** https://wmaterkowska.github.io/bongos/

Built for physics students working through perturbative QFT for the first
time.

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
- **Symbolic simplification** — the combined amplitude is simplified via SymPy
  (running in-browser through Pyodide) and shown in a collapsible panel below
  the canvas.
- **Spin-summed |ℳ|²** — for QED tree-level diagrams, a second collapsible
  panel shows the spin- and polarisation-averaged squared amplitude, evaluated
  analytically using Dirac trace identities and expressed in Mandelstam
  variables. Møller (two open chains) and Compton (one chain, two photons)
  topologies are supported.
- **Quiz mode** — toggle it on to hide every factor card and momentum label
  behind a blur. Click a card to reveal it; click the symmetry/momentum card
  to also reveal the canvas momentum labels. Any edit to the diagram, or
  switching theory, covers everything again. Example diagrams always start
  fully revealed.
- **Multiple theories** — switch between φ⁴, φ³, and QED from the toolbar
  selector. Each theory has its own vertex factor, propagator, external-leg
  rules, and example diagrams.
- **Example diagrams** — loadable from the toolbar:
  - φ⁴: tree-level 2→2, 1-loop bubble, tadpole, 2-loop sunset
  - φ³: tree-level 2→2, 1-loop self-energy
  - QED: Compton scattering, Møller scattering, Bhabha scattering,
    e⁺e⁻ annihilation, vacuum polarisation

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
simplification and |ℳ|² evaluation load Pyodide + SymPy from a CDN on first
use, so those features need network access at least once per session; if
blocked or offline, the app falls back gracefully instead of erroring.

## Running the tests

Pure-logic modules have console-assertion test files under `test/`, runnable
directly with Node:

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
│   ├── sympy-bridge.js   # Pyodide/SymPy bridge (amplitude + |M|²)
│   ├── simplified-panel.js  # collapsible simplified-amplitude panel
│   ├── msq-panel.js         # collapsible spin-summed |M|² panel
│   ├── quiz.js           # quiz mode cover/reveal state
│   └── constants.js      # theory registry (vertex/propagator/leg rules)
├── py/simplify.py         # SymPy helper: amplitude simplification + |M|²
├── examples/              # example diagram JSON files
└── test/                  # console-assertion unit tests
```

## Adding a new theory

Add an entry to `THEORIES` in `src/constants.js` with vertex factor,
propagator, external-leg rules, and legs-per-vertex. The toolbar selector,
rules engine, canvas, and example loader all pick it up automatically.
Set `supportsEdgeTypes: true` and define `edgeTypes` if the theory needs
distinct edge types (as QED does for fermion vs. photon lines).

## Roadmap

- **v1** — core builder (shipped)
- **v2** — symbolic simplification, momentum routing, exact symmetry factor,
  quiz mode (shipped)
- **v3** — φ³ and QED via the existing theory registry; spin-summed |ℳ|²
  for QED tree-level diagrams (shipped)
- **v4** — derive Feynman rules from a user-entered Lagrangian
- **v5** — native mobile port (optional)

## License

[GNU GPLv3](LICENSE).
