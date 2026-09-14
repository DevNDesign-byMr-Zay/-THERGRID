import test from 'node:test';
import assert from 'node:assert/strict';

import { solveQubo } from './quantum-inspired.js';
import { benchmarkOptimization, compareOptimization, solveQuboExactly } from './benchmark.js';

test('exact baseline identifies the known optimum', () => {
  const problem = { linear: [-2, -1], quadratic: [[0, 0], [0, 0]] };
  const exact = solveQuboExactly(problem);

  assert.deepEqual(exact.bits, [1, 1]);
  assert.equal(exact.objective, -3);
  assert.equal(exact.states, undefined);
  assert.equal(exact.variables, 2);
});

test('comparison reports the candidate objective gap', () => {
  const problem = { linear: [-2, -1], quadratic: [[0, 0], [0, 0]] };
  const exact = solveQuboExactly(problem);
  const candidate = solveQubo({ ...problem, seed: 11, iterations: 100 });
  const comparison = compareOptimization(candidate, exact);

  assert.equal(comparison.exactBackend, 'thergrid-classical-exact-reference-v1');
  assert.equal(comparison.candidateBackend, 'thergrid-qis-reference-v1');
  assert.equal(comparison.objectiveGap, 0);
  assert.equal(comparison.matchedObjective, true);
});

test('benchmark helper delegates to the maintained exact reference', () => {
  const problem = { linear: [-2, -1], quadratic: [[0, 0], [0, 0]] };
  const result = benchmarkOptimization(problem, {
    backend: 'test-candidate-v1',
    objective: -3,
  });

  assert.equal(result.exact.backend, 'thergrid-classical-exact-reference-v1');
  assert.equal(result.exact.algorithm, 'exhaustive-binary-search');
  assert.deepEqual(result.exact.bits, [1, 1]);
  assert.equal(result.comparison.objectiveGap, 0);
});

test('exact baseline refuses unbounded growth', () => {
  assert.throws(
    () => solveQuboExactly({ linear: Array.from({ length: 21 }, () => 0) }),
    /limited to 20 binary variables/,
  );
});
