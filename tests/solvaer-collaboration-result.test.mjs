import test from 'node:test';
import assert from 'node:assert/strict';
import { createSolvaerOptimizationRequest } from '../src/solvaer-optimization-contract.mjs';
import { validateSolvaerCollaborationResult } from '../src/solvaer-collaboration-result.mjs';

test('normalizes a safe SOLVÆR proposal for simulation', () => {
  const request = createSolvaerOptimizationRequest({
    experimentId: 'exp-1',
    snapshotId: 'snap-1',
    twinStateRef: 'twin-state:snap-1',
    objective: 'reduce residual balance',
    constraints: { maxDeltaKw: 5 },
  });
  const result = validateSolvaerCollaborationResult({
    request,
    candidate: {
      experimentId: 'exp-1',
      snapshotId: 'snap-1',
      proposal: { dispatchKw: 2 },
      objective: 'reduce residual balance',
    },
    provenanceRef: { experimentId: 'exp-1', snapshotId: 'snap-1' },
  });
  assert.deepEqual(result.proposal, { dispatchKw: 2 });
  assert.equal(result.handoff, 'simulation-required');
  assert.equal(result.safety.authoritative, false);
  assert.equal(result.safety.actuatesHardware, false);
});

test('rejects a candidate that attempts physical authority', () => {
  const request = createSolvaerOptimizationRequest({
    experimentId: 'exp-2',
    snapshotId: 'snap-2',
    twinStateRef: 'twin-state:snap-2',
    objective: 'explore',
  });
  assert.throws(
    () =>
      validateSolvaerCollaborationResult({
        request,
        candidate: {
          experimentId: 'exp-2',
          snapshotId: 'snap-2',
          proposal: {},
          actuatesHardware: true,
        },
        provenanceRef: { experimentId: 'exp-2', snapshotId: 'snap-2' },
      }),
    /physical actuation/,
  );
});
