import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateQubo, solveQubo } from './quantum-inspired.js';

test('evaluates QUBO objective', () => {
  assert.equal(evaluateQubo([1, 2], [[0, 0], [0, 0]], [1, 0]), 1);
  assert.equal(evaluateQubo([1, 1], [[0, 3], [0, 0]], [1, 1]), 5);
});

test('produces identical results for identical seeds', () => {
  const problem = { linear: [-2, -1, 3], quadratic: [[0, 1, 0], [0, 0, -2], [0, 0, 0]], seed: 42, iterations: 500 };
  assert.deepEqual(solveQubo(problem), solveQubo(problem));
});

test('returns auditable backend identity', () => {
  const result = solveQubo({ linear: [-1], seed: 7, iterations: 20 });
  assert.equal(result.backend, 'thergrid-qis-reference-v1');
  assert.equal(result.algorithm, 'deterministic-simulated-annealing-qubo');
  assert.equal(result.seed, 7);
  assert.ok(Number.isFinite(result.objective));
});
