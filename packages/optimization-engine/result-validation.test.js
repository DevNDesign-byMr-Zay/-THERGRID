import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuboProblem } from './solver-contract.js';
import { normalizeOptimizationResult, validateOptimizationResult } from './result-validation.js';

test('accepts a binary result matching the QUBO shape', () => {
  const problem = createQuboProblem({ linear: [-2, -1], quadratic: [[1, 0, 0.5]] });
  const result = { bits: [1, 1], objective: -2.5, backend: 'test' };
  assert.equal(validateOptimizationResult(problem, result), result);
});

test('rejects malformed result bits and objective', () => {
  const problem = createQuboProblem({ linear: [-1, 2] });
  assert.throws(() => validateOptimizationResult(problem, { bits: [1], objective: -1 }), /match the problem/);
  assert.throws(() => validateOptimizationResult(problem, { bits: [1, 2], objective: -1 }), /must be binary/);
  assert.throws(() => validateOptimizationResult(problem, { bits: [1, 0], objective: Number.NaN }), /must be finite/);
});

test('normalizes problem ordering while preserving result values', () => {
  const problem = createQuboProblem({ linear: [-1, -2], quadratic: [[1, 0, 3]] });
  const normalized = normalizeOptimizationResult(problem, { bits: [1, 0], objective: -1 });
  assert.deepEqual(normalized.problem.quadratic, [[0, 1, 3]]);
  assert.deepEqual(normalized.result.bits, [1, 0]);
});
