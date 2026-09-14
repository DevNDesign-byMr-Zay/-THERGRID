import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBenchmarkReceipt,
  validateBenchmarkReceipt,
} from './benchmark-receipt.js';

test('benchmark receipts reject invalid measurement inputs before execution', () => {
  assert.throws(
    () => createBenchmarkReceipt({ linear: [] }),
    /linear coefficients are required/,
  );
  assert.throws(
    () => createBenchmarkReceipt({ linear: [1, Number.NaN] }),
    /linear coefficients must be finite/,
  );
  assert.throws(
    () => createBenchmarkReceipt({ linear: [1], quadratic: {} }),
    /quadratic coefficients must be an array/,
  );
  assert.throws(
    () => createBenchmarkReceipt({ linear: [1], seed: -1 }),
    /seed must be a non-negative integer/,
  );
  assert.throws(
    () => createBenchmarkReceipt({ linear: [1], iterations: 0 }),
    /iterations must be a positive integer/,
  );
});

test('benchmark receipt remains serializable for a valid deterministic input', () => {
  const receipt = createBenchmarkReceipt({ linear: [1, -2], seed: 7, iterations: 20 });
  assert.equal(receipt.schema, 'thergrid-optimization-benchmark-receipt-v1');
  assert.equal(receipt.problem.variableCount, 2);
  assert.equal(receipt.configuration.seed, 7);
  assert.equal(receipt.configuration.iterations, 20);
  assert.ok(Number.isInteger(receipt.durationMs));
  assert.ok(receipt.durationMs >= 0);
  assert.equal(validateBenchmarkReceipt(receipt), receipt);
  assert.doesNotThrow(() => JSON.stringify(receipt));
});

test('receipt boundary rejects structurally tampered evidence', () => {
  const receipt = createBenchmarkReceipt({ linear: [1, -2], seed: 7, iterations: 20 });
  assert.throws(
    () => validateBenchmarkReceipt({ ...receipt, schema: 'tampered' }),
    /invalid benchmark receipt schema/,
  );
  assert.throws(
    () => validateBenchmarkReceipt({
      ...receipt,
      candidate: { ...receipt.candidate, objective: Number.NaN },
    }),
    /invalid benchmark receipt candidate/,
  );
  assert.throws(
    () => validateBenchmarkReceipt({
      ...receipt,
      comparison: { ...receipt.comparison, relativeGap: Number.POSITIVE_INFINITY },
    }),
    /invalid benchmark receipt comparison/,
  );
});
