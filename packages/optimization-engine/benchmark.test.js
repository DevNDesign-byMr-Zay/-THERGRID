import test from 'node:test';
import assert from 'node:assert/strict';

import { solveQubo } from './quantum-inspired.js';
import { benchmarkAgainstExact, compareOptimization, solveQuboExactly } from './benchmark.js';

test('exact baseline identifies the known optimum', () => {
  const problem = { linear: [-2, -1], quadratic: [[0, 0], [0, 0]] };
  const exact = solveQuboExactly(problem);

  assert.deepEqual(exact.bits, [1, 1]);
  assert.equal(exact.objective, -3);
  assert.equal(exact.states, 4);
});

test('comparison reports the candidate objective gap', () => {
  const problem = { linear: [-2, -1], quadratic: [[0, 0], [0, 0]] };
  const exact = solveQuboExactly(problem);
  const candidate = solveQubo({ ...problem, seed: 11, iterations: 100 });
  const comparison = compareOptimization(candidate, exact);

  assert.equal(comparison.exactBackend, 'thergrid-exact-reference-v1');
  assert.equal(comparison.candidateBackend, 'thergrid-qis-reference-v1');
  assert.equal(comparison.objectiveGap, 0);
  assert.equal(comparison.matchedObjective, true);
});

test('benchmark helper always resolves the maintained exact reference', () => {
  const problem = { linear: [-2, -1], quadratic: [[0, 0], [0, 0]] };
  const candidate = solveQubo({ ...problem, seed: 11, iterations: 100 });
  const receipt = benchmarkAgainstExact(problem, candidate);

  assert.equal(receipt.exact.backend, 'thergrid-exact-reference-v1');
  assert.equal(receipt.comparison.exactBackend, receipt.exact.backend);
  assert.equal(receipt.comparison.matchedObjective, true);
});

test('comparison rejects non-finite objectives', () => {
  const exact = solveQuboExactly({ linear: [-1] });

  assert.throws(
    () => compareOptimization({ backend: 'candidate', objective: Number.POSITIVE_INFINITY }, exact),
    /finite numeric objectives/,
  );
  assert.throws(
    () => compareOptimization({ backend: 'candidate', objective: Number.NaN }, exact),
    /finite numeric objectives/,
  );
  assert.throws(
    () => compareOptimization({ backend: 'candidate', objective: -1 }, { ...exact, objective: Number.NEGATIVE_INFINITY }),
    /finite numeric objectives/,
  );
});

test('exact baseline refuses unbounded growth', () => {
  assert.throws(
    () => solveQuboExactly({ linear: Array.from({ length: 21 }, () => 0) }),
    /limited to 20 binary variables/,
  );
});
