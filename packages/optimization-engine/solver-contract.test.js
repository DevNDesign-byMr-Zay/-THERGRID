import test from 'node:test';
import assert from 'node:assert/strict';

import { createQuboProblem, runOptimization } from './solver-contract.js';
import { createReferenceProvider } from './quantum-inspired.js';

test('reference backend runs through the provider-neutral contract', () => {
  const problem = createQuboProblem({
    linear: [-2, -1],
    quadratic: [[0, 0], [0, 0]],
  });

  const result = runOptimization(createReferenceProvider({ seed: 7, iterations: 300 }), problem);

  assert.equal(result.problemKind, 'qubo');
  assert.equal(result.problemVersion, 1);
  assert.equal(result.backend, 'thergrid-qis-reference-v1');
  assert.deepEqual(result.bits, [1, 1]);
  assert.equal(result.objective, -3);
});

test('contract rejects a non-QUBO problem', () => {
  assert.throws(
    () => runOptimization(createReferenceProvider(), { kind: 'other', version: 1 }),
    /version 1 QUBO problem/,
  );
});
