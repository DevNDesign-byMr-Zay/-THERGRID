import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuboProblem, runOptimization } from './solver-contract.js';
import { createReferenceProvider } from './quantum-inspired-provider.js';

test('provider adapter preserves the QUBO contract and audit fields', () => {
  const problem = createQuboProblem({ linear: [-2, -1] });
  const result = runOptimization(createReferenceProvider({ seed: 7, iterations: 300 }), problem);
  assert.equal(result.problemKind, 'qubo');
  assert.equal(result.problemVersion, 1);
  assert.equal(result.backend, 'thergrid-qis-reference-v1');
  assert.equal(result.seed, 7);
  assert.equal(result.iterations, 300);
  assert.deepEqual(result.bits, [1, 1]);
  assert.equal(result.objective, -3);
});

test('rejects non-finite problem coefficients', () => {
  assert.throws(() => createQuboProblem({ linear: [1, NaN] }), /finite numbers/);
});

test('rejects provider results whose shape does not match the problem', () => {
  const problem = createQuboProblem({ linear: [-1, 1] });
  assert.throws(
    () => runOptimization({ solve: () => ({ bits: [1], objective: -1 }) }, problem),
    /mismatched binary result/,
  );
});

test('rejects a numerically better but malformed result', () => {
  const problem = createQuboProblem({ linear: [-1, 1] });
  assert.throws(
    () => runOptimization({ solve: () => ({ bits: [1, 0], objective: Number.NEGATIVE_INFINITY }) }, problem),
    /non-finite objective/,
  );
});
