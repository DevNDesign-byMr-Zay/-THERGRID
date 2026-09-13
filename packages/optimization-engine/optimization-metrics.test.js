import test from 'node:test';
import assert from 'node:assert/strict';
import { compareOptimizationResults } from './optimization-metrics.js';

test('comparison reports exact and relative objective gaps', () => {
  assert.deepEqual(
    compareOptimizationResults({ objective: -10 }, { objective: -9 }),
    {
      referenceObjective: -10,
      candidateObjective: -9,
      objectiveGap: 1,
      relativeGap: 0.1,
      candidateMatchesReference: false,
    },
  );
});
