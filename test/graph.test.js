// Simple console-assertion tests for src/graph.js
// Run with: node --experimental-vm-modules test/graph.test.js
// (or open in a browser via a test runner if preferred)

import {
  createGraph, addNode, addEdge, removeNode, removeEdge,
  getNeighbours, countLegs, internalEdges, externalEdges, countLoops,
} from '../src/graph.js';

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

function assertEqual(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) console.error(`    got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
  assert(label, ok);
}

// ── createGraph ───────────────────────────────────────────────────────
{
  console.log('createGraph');
  const g = createGraph();
  assert('nodes is empty', g.nodes.length === 0);
  assert('edges is empty', g.edges.length === 0);
}

// ── addNode / removeNode ──────────────────────────────────────────────
{
  console.log('addNode / removeNode');
  let g = createGraph();
  g = addNode(g, 'vertex', 100, 200);
  assert('node added', g.nodes.length === 1);
  assertEqual('node type', g.nodes[0].type, 'vertex');

  g = addNode(g, 'external', 50, 50);
  assert('second node added', g.nodes.length === 2);

  const id = g.nodes[0].id;
  g = removeNode(g, id);
  assert('node removed', g.nodes.length === 1);
  assert('remaining node is external', g.nodes[0].type === 'external');
}

// ── addEdge / removeEdge ──────────────────────────────────────────────
{
  console.log('addEdge / removeEdge');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  g = addNode(g, 'vertex', 10, 0);
  const [a, b] = g.nodes;
  g = addEdge(g, a.id, b.id);
  assert('edge added', g.edges.length === 1);

  const eid = g.edges[0].id;
  g = removeEdge(g, eid);
  assert('edge removed', g.edges.length === 0);
}

// ── removeNode removes connected edges ───────────────────────────────
{
  console.log('removeNode cascades edges');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  g = addNode(g, 'vertex', 10, 0);
  const [a, b] = g.nodes;
  g = addEdge(g, a.id, b.id);
  g = removeNode(g, a.id);
  assert('edge removed on node delete', g.edges.length === 0);
}

// ── countLegs ────────────────────────────────────────────────────────
{
  console.log('countLegs');
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  g = addNode(g, 'vertex', 10, 0);
  g = addNode(g, 'external', -10, 0);
  const [v1, v2, ext] = g.nodes;
  g = addEdge(g, v1.id, v2.id);
  g = addEdge(g, ext.id, v1.id);
  assertEqual('v1 has 2 legs', countLegs(g, v1.id), 2);
  assertEqual('v2 has 1 leg', countLegs(g, v2.id), 1);
}

// ── internalEdges / externalEdges ─────────────────────────────────────
{
  console.log('internalEdges / externalEdges — tree-level 2→2');
  let g = createGraph();
  // V0 and V1 are vertices; E2–E5 are external
  g = addNode(g, 'vertex', 190, 220);   // 0
  g = addNode(g, 'vertex', 330, 220);   // 1
  g = addNode(g, 'external', 100, 150); // 2
  g = addNode(g, 'external', 100, 290); // 3
  g = addNode(g, 'external', 420, 150); // 4
  g = addNode(g, 'external', 420, 290); // 5
  const [v0, v1, e2, e3, e4, e5] = g.nodes;
  g = addEdge(g, v0.id, v1.id); // internal
  g = addEdge(g, e2.id, v0.id);
  g = addEdge(g, e3.id, v0.id);
  g = addEdge(g, e4.id, v1.id);
  g = addEdge(g, e5.id, v1.id);

  assertEqual('1 internal edge', internalEdges(g).length, 1);
  assertEqual('4 external edges', externalEdges(g).length, 4);
}

// ── countLoops ───────────────────────────────────────────────────────
{
  console.log('countLoops');
  // Tree-level 2→2: V=2, I=1 → L = 1 - 2 + 1 = 0
  let g = createGraph();
  g = addNode(g, 'vertex', 0, 0);
  g = addNode(g, 'vertex', 10, 0);
  const [v0, v1] = g.nodes;
  g = addEdge(g, v0.id, v1.id);
  assertEqual('tree-level: 0 loops', countLoops(g), 0);

  // Figure-8 vacuum: 1 vertex, 2 self-loops → V=1, I=2 → L = 2 - 1 + 1 = 2
  let g2 = createGraph();
  g2 = addNode(g2, 'vertex', 0, 0);
  const [v] = g2.nodes;
  g2 = addEdge(g2, v.id, v.id);
  g2 = addEdge(g2, v.id, v.id);
  assertEqual('figure-8: 2 loops', countLoops(g2), 2);
}

// ── Summary ───────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
