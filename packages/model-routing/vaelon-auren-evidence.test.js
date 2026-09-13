import test from 'node:test';
import assert from 'node:assert/strict';
import { createVaelonEvidence } from './vaelon-auren-evidence.js';

test('creates an AUREN-consumable observational evidence handoff', () => {
  const evidence = createVaelonEvidence({
    requestId: 'req-17',
    result: {
      backend: 'thergrid-qis-reference-v1',
      algorithm: 'deterministic-simulated-annealing-qubo',
      seed: 17,
      objective: -3,
    },
    durationMs: 8,
  });

  assert.deepEqual(evidence, {
    contract: 'thergrid.model-routing',
    version: '1.0',
    capability: 'optimization.binary-qubo-reference',
    requestId: 'req-17',
    status: 'completed',
    evidence: {
      backend: 'thergrid-qis-reference-v1',
      algorithm: 'deterministic-simulated-annealing-qubo',
      seed: 17,
      objective: -3,
      durationMs: 8,
    },
  });
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(Object.isFrozen(evidence.evidence), true);
});

test('does not invent missing solver evidence', () => {
  const evidence = createVaelonEvidence({ requestId: 'req-empty', result: {} });
  assert.equal(evidence.evidence.backend, null);
  assert.equal(evidence.evidence.algorithm, null);
  assert.equal(evidence.evidence.seed, null);
  assert.equal(evidence.evidence.objective, null);
});
