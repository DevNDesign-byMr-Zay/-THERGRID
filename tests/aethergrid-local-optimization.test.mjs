import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runLocalQuboComparison } from '../apps/aethergrid-console/local-optimization-runtime.mjs';
import { solveQubo } from '../packages/optimization-engine/quantum-inspired.js';

const small = {
  linear: [-2, -1],
  quadratic: [
    [0, 3],
    [0, 0],
  ],
  seed: 42,
  iterations: 200,
};

test('exact local QUBO solves a real two-bit competition, with traceable comparison', () => {
  const result = runLocalQuboComparison(small);
  assert.equal(result.schemaVersion, '1.0');
  assert.equal(result.problemType, 'qubo');
  assert.equal(result.provider, 'aethergrid-local-cpu');
  assert.equal(result.executionType, 'classical-cpu');
  assert.equal(result.hardwareSubmitted, false);
  assert.equal(result.hardwareExecuted, false);
  assert.equal(result.advisoryOnly, true);
  assert.deepEqual(result.exact.bits, [1, 0]);
  assert.equal(result.exact.objective, -2);
  assert.equal(result.exact.optimalityProven, true);
  assert.equal(result.exact.statesEvaluated, 4);
  assert.equal(result.annealing.seed, 42);
  assert.ok(result.annealing.objective >= result.exact.objective);
  assert.equal(result.objectiveGap, result.annealing.objective - result.exact.objective);
  assert.match(result.receipt, /^[0-9a-f]{64}$/u);
  assert.match(result.inputReceipt, /^[0-9a-f]{64}$/u);
});

test('identical input and seed produce identical results and receipts', () => {
  assert.deepEqual(runLocalQuboComparison(small), runLocalQuboComparison(small));
});

test('ties use stable all-zero exact solution, including zero objective', () => {
  const result = runLocalQuboComparison({
    linear: [0, 0, 0],
    quadratic: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    seed: 7,
    iterations: 10,
  });
  assert.deepEqual(result.exact.bits, [0, 0, 0]);
  assert.equal(result.exact.objective, 0);
  assert.equal(result.exact.statesEvaluated, 8);
});

test('exact reference is explicitly skipped beyond safe bound without claiming optimality', () => {
  const result = runLocalQuboComparison({
    linear: Array(17).fill(-1),
    seed: 9,
    iterations: 50,
  });
  assert.equal(result.exact, null);
  assert.equal(result.objectiveGap, null);
  assert.equal(result.annealing.optimalityProven, false);
  assert.equal(result.exactUnavailableReason, 'dimension-exceeds-exact-limit');
  assert.equal(result.hardwareExecuted, false);
});

test('invalid, ambiguous, unbounded and non-finite QUBO inputs are rejected', () => {
  const invalid = [
    { linear: [] },
    { linear: [Number.NaN] },
    { linear: Array(65).fill(0) },
    {
      linear: [1, 2],
      quadratic: [
        [0, 0],
        [4, 0],
      ],
    },
    { linear: [1], quadratic: [[2]] },
    { linear: [1], quadratic: [[Number.POSITIVE_INFINITY]] },
    { linear: [1, 2], quadratic: [[0, 1]] },
    { linear: [1], iterations: 0 },
    { linear: [1], iterations: 10001 },
    { linear: [1], seed: 1.5 },
    { linear: [1], seed: -1 },
    { linear: [1], seed: 4294967296 },
  ];
  for (const input of invalid) {
    assert.throws(
      () => runLocalQuboComparison(input),
      { name: 'TypeError' },
      JSON.stringify(input),
    );
  }
});

test('objective receipts differ when the mathematical problem changes', () => {
  const a = runLocalQuboComparison({ linear: [-2, 1], seed: 1, iterations: 20 });
  const b = runLocalQuboComparison({ linear: [-2, 2], seed: 1, iterations: 20 });
  assert.notEqual(a.inputReceipt, b.inputReceipt);
  assert.notEqual(a.receipt, b.receipt);
});

test('portable local annealing remains compatible with repository baseline without importing unbundled packages', async () => {
  const source = await readFile(
    new URL('../apps/aethergrid-console/local-optimization-runtime.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /\.\.\/\.\.\/packages\//u);
  const result = runLocalQuboComparison(small);
  const reference = solveQubo(small);
  assert.deepEqual(result.annealing.bits, [...reference.bits]);
  assert.equal(result.annealing.objective, reference.objective);
});

test('all exact states reproduce their returned objective with independent QUBO evaluator', () => {
  const cases = [
    { linear: [2], seed: 0 },
    { linear: [-3, 2, -1], quadratic: [[0, 3, -2], [0, 0, 4], [0, 0, 0]], seed: 12 },
    { linear: [0, 0, 0, 0], seed: 123 },
    { linear: [-1, -1, -1, -1, -1], seed: 11 },
  ];
  for (const problem of cases) {
    const result = runLocalQuboComparison(problem);
    const size = problem.linear.length;
    const quadratic =
      problem.quadratic ?? Array.from({ length: size }, () => Array(size).fill(0));
    let lowest = Infinity;
    for (let mask = 0; mask < 2 ** size; mask += 1) {
      const bits = problem.linear.map((_, index) => (mask >>> index) & 1);
      let candidate = 0;
      for (let i = 0; i < size; i += 1) {
        candidate += problem.linear[i] * bits[i];
        for (let j = i + 1; j < size; j += 1) {
          candidate += quadratic[i][j] * bits[i] * bits[j];
        }
      }
      lowest = Math.min(lowest, candidate);
    }
    assert.equal(result.exact.objective, lowest);
    assert.ok(result.annealing.objective >= lowest);
    assert.equal(result.exact.statesEvaluated, 2 ** size);
  }
});

test('receipt fingerprints include problem seed, solver iterations, and classical-execution boundary', () => {
  const seedChange = runLocalQuboComparison({ ...small, seed: 43 });
  const iterationChange = runLocalQuboComparison({ ...small, iterations: 201 });
  const original = runLocalQuboComparison(small);
  assert.notEqual(original.inputReceipt, seedChange.inputReceipt);
  assert.notEqual(original.inputReceipt, iterationChange.inputReceipt);
  assert.notEqual(original.receipt, seedChange.receipt);
  assert.notEqual(original.receipt, iterationChange.receipt);
  for (const result of [original, seedChange, iterationChange]) {
    assert.equal(result.executionType, 'classical-cpu');
    assert.equal(result.hardwareSubmitted, false);
    assert.equal(result.hardwareExecuted, false);
  }
});
