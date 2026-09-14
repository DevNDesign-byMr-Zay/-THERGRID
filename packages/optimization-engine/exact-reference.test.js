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

test('exact reference rejects non-finite coefficients', () => {
  assert.throws(() => solveQuboExactly({ linear: [-1, Infinity] }), /linear coefficients must be finite/);
  assert.throws(() => solveQuboExactly({ linear: [-1], quadratic: [[0, NaN]] }), /quadratic coefficients must be finite/);
});

test('exact reference rejects malformed quadratic containers', () => {
  assert.throws(() => solveQuboExactly({ linear: [-1], quadratic: {} }), /quadratic coefficients must be an array/);
  assert.throws(() => solveQuboExactly({ linear: [-1], quadratic: [[0], 1] }), /contain arrays/);
});
