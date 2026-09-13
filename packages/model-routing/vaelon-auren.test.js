import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VAELON_CAPABILITY,
  createVaelonRequest,
  createVaelonResult,
} from './vaelon-auren.js';

test('creates a provider-neutral request that AUREN can hand to VÆLON', () => {
  const request = createVaelonRequest({
    requestId: 'demo-001',
    linear: [-2, 1],
    quadratic: [[0, 0], [0, 0]],
    seed: 7,
  });

  assert.equal(request.contract, 'thergrid.model-routing');
  assert.equal(request.capability, VAELON_CAPABILITY);
  assert.equal(request.target, 'VÆLON');
  assert.deepEqual(request.problem.linear, [-2, 1]);
});

test('wraps a solver result with reproducibility evidence', () => {
  const result = createVaelonResult({
    requestId: 'demo-001',
    result: {
      backend: 'thergrid-qis-reference-v1',
      algorithm: 'deterministic-simulated-annealing-qubo',
      seed: 7,
      objective: -2,
      bits: [1, 0],
    },
    durationMs: 3,
  });

  assert.equal(result.source, 'VÆLON');
  assert.equal(result.requestId, 'demo-001');
  assert.equal(result.evidence.seed, 7);
  assert.equal(result.evidence.objective, -2);
  assert.equal(result.evidence.durationMs, 3);
});
