import { computeAutomorphismCount } from './automorphism.js';

// Stage 5a (v1) was a lookup table keyed by the (V, E, I, L) signature.
// It's gone: that signature isn't a reliable cache key — the sunset diagram
// (3 parallel lines between 2 vertices, S=6) and the double-tadpole (2
// self-loops + 1 connecting line, S=4) both have V=2, E=2, I=3, L=2, so a
// signature-only lookup returns the wrong S for one of them. Stage 5b
// (src/automorphism.js) computes the exact answer directly from the graph's
// real topology instead, and is fast enough at this scale to use always.
export function computeSymmetryFactor(graph, analysis) {
  if (analysis.V === 0) return null;
  return computeAutomorphismCount(graph);
}
