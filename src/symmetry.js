import { internalEdges, externalEdges, countLoops } from './graph.js';

// Stage 5a: lookup table for common φ⁴ diagrams.
// Matched by (V, E, I, L) signature. Stage 5b (full automorphism search) comes in v2.

const LOOKUP = [
  // (V, E, I, L) → S
  { V: 1, E: 4, I: 0, L: 0, S: 1 },  // single vertex, 4 external
  { V: 2, E: 4, I: 1, L: 0, S: 2 },  // tree-level 2→2 scattering
  { V: 1, E: 0, I: 2, L: 2, S: 8 },  // figure-8 vacuum bubble  (approx — true S=8 needs automorphism)
  { V: 2, E: 2, I: 3, L: 2, S: 2 },  // sunset / sunrise diagram
  { V: 1, E: 2, I: 1, L: 1, S: 2 },  // tadpole on external line
];

export function computeSymmetryFactor(graph, analysis) {
  const { V, E, I, L } = analysis;
  const match = LOOKUP.find(
    row => row.V === V && row.E === E && row.I === I && row.L === L
  );
  return match ? match.S : null; // null = unknown, rendered as '?'
}
