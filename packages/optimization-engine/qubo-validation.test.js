import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuboProblem } from './solver-contract.js';
import { normalizeQuboProblem } from './qubo-validation.js';

test('normalizes unordered quadratic terms deterministically', () => {
  const problem = createQuboProblem({ linear: [1, -2, 0.5], quadratic: [[2, 0, 3], [1, 2, -4]] });
  assert.deepEqual(normalizeQuboProblem(problem), {
    kind: 'qubo', version: 1, linear: [1, -2, 0.5], quadratic: [[0, 2, 3], [1, 2, -4]],
  });
});

test('rejects malformed coefficient values and indices', () => {
  assert.throws(() => normalizeQuboProblem({ kind: 'qubo', version: 1, linear: [1, Number.NaN], quadratic: [] }), /finite numbers/);
  assert.throws(() => normalizeQuboProblem({ kind: 'qubo', version: 1, linear: [1, 2], quadratic: [[0, 2, 1]] }), /existing variables/);
  assert.throws(() => normalizeQuboProblem({ kind: 'qubo', version: 1, linear: [1, 2], quadratic: [[0, 0, 1]] }), /diagonal/);
});
