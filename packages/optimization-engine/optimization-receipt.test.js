import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuboProblem } from './solver-contract.js';
import { createOptimizationReceipt } from './optimization-receipt.js';

test('creates a compact deterministic optimization receipt', () => {
  const problem = createQuboProblem({ linear: [-2, 1] });
  const receipt = createOptimizationReceipt({
    problem,
    result: { backend: 'reference', algorithm: 'test', seed: 7, iterations: 10, bits: [1, 0], objective: -2 },
    startedAt: '2026-09-13T00:00:00.000Z',
    durationMs: 2,
  });
  assert.deepEqual(receipt.problem, { kind: 'qubo', version: 1, variableCount: 2 });
  assert.equal(receipt.solver.backend, 'reference');
  assert.deepEqual(receipt.bits, [1, 0]);
  assert.equal(receipt.objective, -2);
});

test('rejects invalid receipt timing', () => {
  const problem = createQuboProblem({ linear: [-1] });
  assert.throws(() => createOptimizationReceipt({ problem, result: { objective: -1 }, durationMs: -1 }), /non-negative/);
  assert.throws(() => createOptimizationReceipt({ problem, result: { objective: -1 }, startedAt: 42 }), /ISO string/);
});
