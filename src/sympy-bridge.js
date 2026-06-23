// Lazily loads the Pyodide WASM Python runtime, plus SymPy, once per page
// session. Pyodide itself is loaded as a global via the <script> tag in
// index.html (the same pattern already used there for KaTeX) — this module
// only manages the async loadPyodide()/loadPackage() lifecycle and caches
// the result so repeated calls never reload anything.

let _pyodidePromise = null;

export function getPyodide() {
  if (!_pyodidePromise) {
    _pyodidePromise = loadPyodide().then(async pyodide => {
      await pyodide.loadPackage('sympy');
      return pyodide;
    });
  }
  return _pyodidePromise;
}
