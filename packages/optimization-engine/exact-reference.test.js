import test from 'node:test';
import assert from 'node:assert/strict';
import { solveQuboExactly } from './exact-reference.js';

test('exact reference finds the global minimum of a small QUBO', () => {
  const result = solveQuboExactly({
    linear: [-2, -1, 0.5],
    quadratic: [[0, 3, 0], [0, 0, -4], [0, 0, 0]],
  });
  assert.deepEqual(result.bits, [1, 1, 1]);
  assert.equal(result.objective, -3.5);
});

test('exact reference rejects oversized problems', () => {
  assert.throws(() => solveQuboExactly({ linear: Array(21).fill(1) }), /limited to 20/);
});
