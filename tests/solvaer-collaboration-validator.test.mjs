import test from 'node:test';
import assert from 'node:assert/strict';
import { createSolvaerOptimizationRequest } from '../src/solvaer-optimization-contract.mjs';
import { validateSolvaerCollaborationResult } from '../src/solvaer-collaboration-validator.mjs';

const request = createSolvaerOptimizationRequest({
  experimentId: 'exp-1',
  snapshotId: 'snap-1',
  twinStateRef: 'twin-state:snap-1',
  objective: 'explore',
});

test('accepts a correctly anchored advisory candidate', () => {
  assert.equal(
    validateSolvaerCollaborationResult({
      request,
      candidate: {
        experimentId: 'exp-1',
        snapshotId: 'snap-1',
        proposal: { dispatch: {} },
      },
      provenanceRef: { experimentId: 'exp-1', snapshotId: 'snap-1' },
    }),
    true,
  );
});

test('rejects cross-snapshot candidates', () => {
  assert.equal(
    validateSolvaerCollaborationResult({
      request,
      candidate: { experimentId: 'exp-1', snapshotId: 'snap-2' },
      provenanceRef: { experimentId: 'exp-1', snapshotId: 'snap-1' },
    }),
    false,
  );
});

test('rejects authoritative or actuating candidates', () => {
  assert.equal(
    validateSolvaerCollaborationResult({
      request,
      candidate: {
        experimentId: 'exp-1',
        snapshotId: 'snap-1',
        authoritative: true,
      },
      provenanceRef: { experimentId: 'exp-1', snapshotId: 'snap-1' },
    }),
    false,
  );
  assert.equal(
    validateSolvaerCollaborationResult({
      request,
      candidate: {
        experimentId: 'exp-1',
        snapshotId: 'snap-1',
        actuatesHardware: true,
      },
      provenanceRef: { experimentId: 'exp-1', snapshotId: 'snap-1' },
    }),
    false,
  );
});
