import test from 'node:test';
import assert from 'node:assert/strict';
import { createBenchmarkReceipt } from './benchmark-receipt.js';

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
  assert.doesNotThrow(() => JSON.stringify(receipt));
});
