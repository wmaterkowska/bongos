// Simple console-assertion tests for src/rules.js
// Run with: node test/rules.test.js

import { createGraph, addNode, addEdge } from '../src/graph.js';
import { analyseGraph } from '../src/rules.js';

const theory = { legsPerVertex: 4 };

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function hasWarningMatching(analysis, pattern) {
  return analysis.warnings.some(w => pattern.test(w));
}

// ── A single connected tree diagram: no disconnected-pieces warning ────
{
  console.log('single connected diagram');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  const [v] = g.nodes;
  for (let i = 0; i < 4; i++) {
    g = addNode(g, 'external', i, 0);
    g = addEdge(g, g.nodes.at(-1).id, v.id);
  }
  const analysis = analyseGraph(g, theory);
  assert('no disconnected-pieces warning', !hasWarningMatching(analysis, /disconnected pieces/));
  assert('valid', analysis.valid);
}

// ── Two separate sub-diagrams drawn on the same canvas ──────────────────
{
  console.log('two disconnected sub-diagrams');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  const [v1] = g.nodes;
  for (let i = 0; i < 4; i++) {
    g = addNode(g, 'external', i, 0);
    g = addEdge(g, g.nodes.at(-1).id, v1.id);
  }
  g = addNode(g, 'vertex', 500, 0);
  const v2 = g.nodes.at(-1);
  for (let i = 0; i < 4; i++) {
    g = addNode(g, 'external', 500 + i, 0);
    g = addEdge(g, g.nodes.at(-1).id, v2.id);
  }

  const analysis = analyseGraph(g, theory);
  assert('flags 2 disconnected pieces', hasWarningMatching(analysis, /has 2 disconnected pieces/));
  assert('invalid', !analysis.valid);
}

// ── A connected diagram plus one truly isolated node ────────────────────
// Should get the existing "not connected to anything" warning, but NOT
// also the disconnected-pieces one -- a lone isolated node isn't "a second
// diagram", just a dangling node, and is already covered by its own warning.
{
  console.log('connected diagram plus one isolated node');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  const [v] = g.nodes;
  for (let i = 0; i < 4; i++) {
    g = addNode(g, 'external', i, 0);
    g = addEdge(g, g.nodes.at(-1).id, v.id);
  }
  g = addNode(g, 'external', 999, 999); // isolated, no edges at all

  const analysis = analyseGraph(g, theory);
  assert('flags the isolated node', hasWarningMatching(analysis, /not connected to anything/));
  assert('does not also flag disconnected pieces', !hasWarningMatching(analysis, /disconnected pieces/));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
