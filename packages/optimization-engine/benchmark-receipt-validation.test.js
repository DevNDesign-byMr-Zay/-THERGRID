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
  assert.throws(() => createBenchmarkReceipt({ linear: [1], quadratic: [[Number.NaN]] }), /quadratic coefficients must be finite/);
  assert.throws(() => createBenchmarkReceipt({ linear: [1], quadratic: [[0], [1]] }), /quadratic rows must not exceed/);
  assert.throws(() => createBenchmarkReceipt({ linear: [1, 2], quadratic: [[0, 0, 2]] }), /quadratic rows must be arrays within/);
  assert.throws(() => createBenchmarkReceipt({ linear: [1], seed: -1 }), /seed must be a non-negative integer/);
  assert.throws(() => createBenchmarkReceipt({ linear: [1], iterations: 0 }), /iterations must be a positive integer/);
});

test('benchmark receipt remains serializable and self-identifying for valid deterministic input', () => {
  const receipt = createBenchmarkReceipt({ linear: [1, -2], quadratic: [[0, 0.5], [0, 0]], seed: 7, iterations: 20 });
  assert.equal(receipt.schema, 'thergrid-optimization-benchmark-receipt-v1');
  assert.match(receipt.measurementFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(receipt.problem.variableCount, 2);
  assert.deepEqual(receipt.problem.linear, [1, -2]);
  assert.deepEqual(receipt.problem.quadratic, [[0, 0.5], [0, 0]]);
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

test('benchmark receipt freezes nested evidence so its identity cannot drift in memory', () => {
  const receipt = createBenchmarkReceipt({ linear: [1, -2], quadratic: [[0, 0.5], [0, 0]], seed: 7, iterations: 20 });
  assert.ok(Object.isFrozen(receipt));
  assert.ok(Object.isFrozen(receipt.problem));
  assert.ok(Object.isFrozen(receipt.problem.linear));
  assert.ok(Object.isFrozen(receipt.problem.quadratic));
  assert.ok(Object.isFrozen(receipt.problem.quadratic[0]));
  assert.ok(Object.isFrozen(receipt.configuration));
  assert.ok(Object.isFrozen(receipt.reference));
  assert.ok(Object.isFrozen(receipt.candidate));
  assert.ok(Object.isFrozen(receipt.comparison));
  assert.throws(() => {
    receipt.problem.linear[0] = 99;
  }, TypeError);
  assert.equal(receipt.problem.linear[0], 1);
  assert.doesNotThrow(() => validateBenchmarkReceipt(receipt));
});

test('benchmark receipt fingerprint is stable across object key ordering', () => {
  const receipt = createBenchmarkReceipt({ linear: [1, -2], quadratic: [[0, 0.5], [0, 0]], seed: 7, iterations: 20 });
  const reordered = {
    measurementFingerprint: receipt.measurementFingerprint,
    durationMs: receipt.durationMs,
    comparison: {
      matchedObjective: receipt.comparison.matchedObjective,
      candidateBackend: receipt.comparison.candidateBackend,
      objectiveGap: receipt.comparison.objectiveGap,
      exactBackend: receipt.comparison.exactBackend,
    },
    candidate: {
      objective: receipt.candidate.objective,
      algorithm: receipt.candidate.algorithm,
      backend: receipt.candidate.backend,
    },
    reference: {
      objective: receipt.reference.objective,
      algorithm: receipt.reference.algorithm,
      backend: receipt.reference.backend,
    },
    configuration: {
      iterations: receipt.configuration.iterations,
      seed: receipt.configuration.seed,
    },
    problem: {
      quadratic: receipt.problem.quadratic,
      linear: receipt.problem.linear,
      variableCount: receipt.problem.variableCount,
      version: receipt.problem.version,
      kind: receipt.problem.kind,
    },
    schema: receipt.schema,
  };
  assert.doesNotThrow(() => validateBenchmarkReceipt(reordered));
});

test('receipt fingerprint binds the canonical QUBO coefficients', () => {
  const receipt = createBenchmarkReceipt({ linear: [1, -2], quadratic: [[0, 0.5], [0, 0]], seed: 7, iterations: 20 });
  assert.throws(() => validateBenchmarkReceipt({
    ...receipt,
    problem: {
      ...receipt.problem,
      linear: [1, -1.9],
    },
  }), /measurement fingerprint mismatch/);
  assert.throws(() => validateBenchmarkReceipt({
    ...receipt,
    problem: {
      ...receipt.problem,
      quadratic: [[0, 0.6], [0, 0]],
    },
  }), /measurement fingerprint mismatch/);
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
