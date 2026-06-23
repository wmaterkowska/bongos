// Simple console-assertion tests for src/momentum.js
// Run with: node test/momentum.test.js

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadFromJSON } from '../src/graph.js';
import { routeMomenta } from '../src/momentum.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function loadExample(name) {
  const json = JSON.parse(readFileSync(join(__dirname, '../examples', name), 'utf8'));
  return loadFromJSON(json);
}

// Renders a MomentumExpr as a deterministic, sorted string like
// "-k_{1}+p_{1}+p_{2}" so two expressions can be compared regardless of
// internal term order.
function exprToString(expr) {
  const parts = expr.terms
    .map(t => (t.sign > 0 ? '+' : '-') + t.symbol)
    .sort();
  return parts.join('');
}

function assertRoute(label, routes, edgeId, expected) {
  const expr = routes.get(edgeId);
  const actual = expr ? exprToString(expr) : undefined;
  const ok = actual === expected;
  if (ok) { console.log(`  ✓ ${label}`); passed++; }
  else {
    console.error(`  ✗ ${label}`);
    console.error(`    got: ${actual}, expected: ${expected}`);
    failed++;
  }
}

// ── Tree-level 2→2: every external leg carries its own momentum ───────
{
  console.log('tree-2to2.json');
  const graph = loadExample('tree-2to2.json');
  const routes = routeMomenta(graph);
  assertRoute('leg 1 -> p_1', routes, 0, '+p_{1}');
  assertRoute('leg 2 -> p_2', routes, 1, '+p_{2}');
  assertRoute('leg 3 -> p_3', routes, 2, '+p_{3}');
  assertRoute('leg 4 -> p_4', routes, 3, '+p_{4}');
}

// ── Bubble: one internal line is the loop momentum k_1, the other is
//    solved by conservation to -(p_3 + p_4 + k_1) at vertex 1 ───────────
{
  console.log('bubble.json');
  const graph = loadExample('bubble.json');
  const routes = routeMomenta(graph);
  assertRoute('first internal line -> -k_1-p_3-p_4', routes, 2, '-k_{1}-p_{3}-p_{4}');
  assertRoute('second (parallel) internal line -> k_1', routes, 3, '+k_{1}');
}

// ── Tadpole: the self-loop is its own independent loop momentum ───────
{
  console.log('tadpole.json');
  const graph = loadExample('tadpole.json');
  const routes = routeMomenta(graph);
  assertRoute('external leg 1 -> p_1', routes, 0, '+p_{1}');
  assertRoute('external leg 2 -> p_2', routes, 1, '+p_{2}');
  assertRoute('self-loop -> k_1', routes, 2, '+k_{1}');
}

// ── Sunset: 2 of the 3 parallel lines are independent loop momenta; the
//    third is solved to -(p_2 + k_1 + k_2), matching the standard
//    "external momentum flows straight through" self-energy routing ────
{
  console.log('sunset.json');
  const graph = loadExample('sunset.json');
  const routes = routeMomenta(graph);
  assertRoute('first parallel line (tree edge) -> -k_1-k_2-p_2', routes, 2, '-k_{1}-k_{2}-p_{2}');
  assertRoute('second parallel line -> k_1', routes, 3, '+k_{1}');
  assertRoute('third parallel line -> k_2', routes, 4, '+k_{2}');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
