import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBenchmarkReceipt,
  validateBenchmarkReceipt,
} from './benchmark-receipt.js';

test('benchmark receipts reject invalid measurement inputs before execution', () => {
  assert.throws(() => createBenchmarkReceipt({ linear: [] }), /linear coefficients are required/);
  assert.throws(() => createBenchmarkReceipt({ linear: [1, Number.NaN] }), /linear coefficients must be finite/);
  assert.throws(() => createBenchmarkReceipt({ linear: [1], quadratic: {} }), /quadratic coefficients must be an array/);
  assert.throws(() => createBenchmarkReceipt({ linear: [1], quadratic: [{ i: 0, j: 1, value: Number.NaN }] }), /quadratic coefficients must contain finite/);
  assert.throws(() => createBenchmarkReceipt({ linear: [1], seed: -1 }), /seed must be a non-negative integer/);
  assert.throws(() => createBenchmarkReceipt({ linear: [1], iterations: 0 }), /iterations must be a positive integer/);
});

test('benchmark receipt remains serializable and self-identifying for valid deterministic input', () => {
  const receipt = createBenchmarkReceipt({ linear: [1, -2], seed: 7, iterations: 20 });
  assert.equal(receipt.schema, 'thergrid-optimization-benchmark-receipt-v1');
  assert.match(receipt.measurementFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(receipt.problem.variableCount, 2);
  assert.equal(receipt.configuration.seed, 7);
  assert.equal(receipt.configuration.iterations, 20);
  assert.equal(receipt.comparison.exactBackend, receipt.reference.backend);
  assert.equal(receipt.comparison.candidateBackend, receipt.candidate.backend);
  assert.equal(receipt.comparison.matchedObjective, receipt.candidate.objective === receipt.reference.objective);
  assert.equal(receipt.comparison.objectiveGap, receipt.candidate.objective - receipt.reference.objective);
  assert.ok(Number.isInteger(receipt.durationMs));
  assert.ok(receipt.durationMs >= 0);
  assert.equal(validateBenchmarkReceipt(receipt), receipt);
  assert.doesNotThrow(() => JSON.stringify(receipt));
});

test('receipt boundary rejects structurally or cryptographically tampered evidence', () => {
  const receipt = createBenchmarkReceipt({ linear: [1, -2], seed: 7, iterations: 20 });
  assert.throws(() => validateBenchmarkReceipt({ ...receipt, schema: 'tampered' }), /invalid benchmark receipt schema/);
  assert.throws(() => validateBenchmarkReceipt({ ...receipt, candidate: { ...receipt.candidate, objective: Number.NaN } }), /invalid benchmark receipt candidate/);
  assert.throws(() => validateBenchmarkReceipt({ ...receipt, comparison: { ...receipt.comparison, objectiveGap: receipt.comparison.objectiveGap + 1 } }), /invalid benchmark receipt comparison/);
  assert.throws(() => validateBenchmarkReceipt({ ...receipt, comparison: { ...receipt.comparison, matchedObjective: !receipt.comparison.matchedObjective } }), /invalid benchmark receipt comparison/);
  assert.throws(() => validateBenchmarkReceipt({ ...receipt, comparison: { ...receipt.comparison, exactBackend: 'forged-reference' } }), /invalid benchmark receipt comparison/);
  assert.throws(() => validateBenchmarkReceipt({ ...receipt, measurementFingerprint: '0'.repeat(64) }), /measurement fingerprint mismatch/);
  assert.throws(() => validateBenchmarkReceipt({ ...receipt, measurementFingerprint: 'not-a-fingerprint' }), /invalid benchmark receipt measurement fingerprint/);
});
