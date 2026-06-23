// Simple console-assertion tests for src/automorphism.js and src/symmetry.js
// Run with: node test/automorphism.test.js
// (needs ES module support — see note in test/graph.test.js)

import { createGraph, addNode, addEdge } from '../src/graph.js';
import { computeAutomorphismCount } from '../src/automorphism.js';
import { computeSymmetryFactor } from '../src/symmetry.js';

let passed = 0;
let failed = 0;

function assertEqual(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) console.error(`    got: ${actual}, expected: ${expected}`);
  if (ok) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}`); failed++; }
}

function analysisOf(graph) {
  // Minimal stand-in for rules.analyseGraph — only V is read by symmetry.js.
  return { V: graph.nodes.filter(n => n.type === 'vertex').length };
}

function checkBoth(label, graph, expectedS) {
  assertEqual(`${label} — automorphism count`, computeAutomorphismCount(graph), expectedS);
  assertEqual(`${label} — computeSymmetryFactor`, computeSymmetryFactor(graph, analysisOf(graph)), expectedS);
}

// ── Tree-level 2→2 (single vertex, 4 external legs): S = 1 ────────────
{
  console.log('tree-level 2→2');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  const [v] = g.nodes;
  for (let i = 0; i < 4; i++) {
    g = addNode(g, 'external', i, 0);
    g = addEdge(g, g.nodes[g.nodes.length - 1].id, v.id);
  }
  checkBoth('tree 2→2', g, 1);
}

// ── 1-loop bubble correction to 2→2: S = 2 ─────────────────────────────
{
  console.log('1-loop bubble');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  g = addNode(g, 'vertex', 10, 0);
  const [v0, v1] = g.nodes;
  g = addNode(g, 'external', -10, -10); g = addEdge(g, g.nodes.at(-1).id, v0.id);
  g = addNode(g, 'external', -10, 10);  g = addEdge(g, g.nodes.at(-1).id, v0.id);
  g = addNode(g, 'external', 20, -10);  g = addEdge(g, g.nodes.at(-1).id, v1.id);
  g = addNode(g, 'external', 20, 10);   g = addEdge(g, g.nodes.at(-1).id, v1.id);
  g = addEdge(g, v0.id, v1.id);
  g = addEdge(g, v0.id, v1.id);
  checkBoth('1-loop bubble', g, 2);
}

// ── Tadpole on external line: S = 2 ────────────────────────────────────
{
  console.log('tadpole');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  const [v] = g.nodes;
  g = addNode(g, 'external', -10, 0); g = addEdge(g, g.nodes.at(-1).id, v.id);
  g = addNode(g, 'external', 10, 0);  g = addEdge(g, g.nodes.at(-1).id, v.id);
  g = addEdge(g, v.id, v.id); // self-loop
  checkBoth('tadpole', g, 2);
}

// ── Figure-8 vacuum bubble (1 vertex, 2 self-loops): S = 8 ─────────────
{
  console.log('figure-8 vacuum bubble');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  const [v] = g.nodes;
  g = addEdge(g, v.id, v.id);
  g = addEdge(g, v.id, v.id);
  checkBoth('figure-8', g, 8);
}

// ── Sunset / sunrise (2 vertices, 3 parallel internal lines, 1 external
//    leg each): S = 6 — corrects a stale Stage 5a lookup entry of S = 2.
{
  console.log('sunset / sunrise');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  g = addNode(g, 'vertex', 10, 0);
  const [v0, v1] = g.nodes;
  g = addNode(g, 'external', -10, 0); g = addEdge(g, g.nodes.at(-1).id, v0.id);
  g = addNode(g, 'external', 20, 0);  g = addEdge(g, g.nodes.at(-1).id, v1.id);
  g = addEdge(g, v0.id, v1.id);
  g = addEdge(g, v0.id, v1.id);
  g = addEdge(g, v0.id, v1.id);
  checkBoth('sunset', g, 6);
}

// ── Double tadpole (2 vertices, each with its own self-loop and external
//    leg, joined by 1 internal line): S = 4. No lookup entry ever covered
//    this — and it shares its (V,E,I,L) = (2,2,3,2) signature with the
//    sunset case above, which is exactly why the signature-only lookup was
//    removed rather than kept as a fast path.
{
  console.log('double tadpole');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  g = addNode(g, 'vertex', 10, 0);
  const [v0, v1] = g.nodes;
  g = addNode(g, 'external', -10, 0); g = addEdge(g, g.nodes.at(-1).id, v0.id);
  g = addNode(g, 'external', 20, 0);  g = addEdge(g, g.nodes.at(-1).id, v1.id);
  g = addEdge(g, v0.id, v0.id); // self-loop at v0
  g = addEdge(g, v1.id, v1.id); // self-loop at v1
  g = addEdge(g, v0.id, v1.id); // connecting line
  checkBoth('double tadpole', g, 4);
}

// ── Summary ───────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
