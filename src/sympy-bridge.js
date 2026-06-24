// Lazily loads the Pyodide WASM Python runtime, plus SymPy and py/simplify.py,
// once per page session. Pyodide itself is loaded as a global via the
// <script> tag in index.html (the same pattern already used there for
// KaTeX) — this module manages the async loadPyodide()/loadPackage()
// lifecycle and caches the result so repeated calls never reload anything.

import { internalEdges } from './graph.js';
import { routeMomenta } from './momentum.js';

let _pyodidePromise = null;
let _ready = false;

// Whether the runtime has already finished loading — lets the UI show a
// one-time "loading symbolic engine…" message instead of "simplifying…"
// for the slow first call.
export function isPyodideReady() {
  return _ready;
}

function getPyodide() {
  if (!_pyodidePromise) {
    _pyodidePromise = loadPyodide().then(async pyodide => {
      await pyodide.loadPackage('sympy');
      const source = await fetch('py/simplify.py').then(res => res.text());
      pyodide.runPython(source);
      _ready = true;
      return pyodide;
    });
  }
  return _pyodidePromise;
}

// Symbolically simplifies the combined amplitude for `graph` and returns
// its LaTeX. The JS<->Python boundary is a single JSON string each way
// (see simplify_amplitude_json in py/simplify.py) so there's no need to
// reason about Pyodide's JS-array/object proxy conversions.
export async function simplifyAmplitude(graph, symmetryFactor) {
  const pyodide = await getPyodide();

  const vertexCount = graph.nodes.filter(n => n.type === 'vertex').length;
  const momenta = routeMomenta(graph);
  const propagators = internalEdges(graph).map(e => momenta.get(e.id));

  const payload = JSON.stringify({ vertexCount, propagators, symmetryFactor });
  const simplifyAmplitudeJson = pyodide.globals.get('simplify_amplitude_json');
  return simplifyAmplitudeJson(payload);
}
