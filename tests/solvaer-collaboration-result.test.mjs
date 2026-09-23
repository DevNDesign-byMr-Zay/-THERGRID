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

test('snapshots and freezes collaboration evidence before simulation', () => {
  const constraints = { maxDeltaKw: 5, nested: { reserveKw: 2 } };
  const request = createSolvaerOptimizationRequest({
    experimentId: 'exp-freeze',
    snapshotId: 'snap-freeze',
    twinStateRef: 'twin-state:snap-freeze',
    objective: 'reduce residual balance',
    constraints,
  });
  const proposal = { dispatchKw: 2, nested: { rampKw: 1 } };
  const provenanceRef = {
    experimentId: 'exp-freeze',
    snapshotId: 'snap-freeze',
    path: { source: 'solvaer' },
  };
  const result = validateSolvaerCollaborationResult({
    request,
    candidate: {
      experimentId: 'exp-freeze',
      snapshotId: 'snap-freeze',
      proposal,
      objective: 'reduce residual balance',
    },
    provenanceRef,
    fallbackUsed: true,
  });

  assert.equal(result.fallbackUsed, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.constraints.nested), true);
  assert.equal(Object.isFrozen(result.proposal.nested), true);
  assert.equal(Object.isFrozen(result.provenanceRef.path), true);
  assert.equal(Object.isFrozen(result.safety), true);

  constraints.nested.reserveKw = 99;
  proposal.nested.rampKw = 99;
  provenanceRef.path.source = 'changed';

  assert.equal(result.constraints.nested.reserveKw, 2);
  assert.equal(result.proposal.nested.rampKw, 1);
  assert.equal(result.provenanceRef.path.source, 'solvaer');
});

test('rejects a candidate objective that conflicts with its request', () => {
  const request = createSolvaerOptimizationRequest({
    experimentId: 'exp-objective',
    snapshotId: 'snap-objective',
    twinStateRef: 'twin-state:snap-objective',
    objective: 'reduce residual balance',
  });

  assert.throws(
    () =>
      validateSolvaerCollaborationResult({
        request,
        candidate: {
          experimentId: 'exp-objective',
          snapshotId: 'snap-objective',
          proposal: { dispatchKw: 2 },
          objective: 'maximize hardware output',
        },
        provenanceRef: { experimentId: 'exp-objective', snapshotId: 'snap-objective' },
      }),
    /candidate objective must match request objective/,
  );
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
