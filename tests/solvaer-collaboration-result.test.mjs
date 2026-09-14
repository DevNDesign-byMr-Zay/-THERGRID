import test from 'node:test';
import assert from 'node:assert/strict';
import { createSolvaerOptimizationRequest } from '../src/solvaer-optimization-contract.mjs';
import { validateSolvaerCollaborationResult } from '../src/solvaer-collaboration-result.mjs';

function createRequest(overrides = {}) {
  return createSolvaerOptimizationRequest({
    experimentId: 'exp-1',
    snapshotId: 'snap-1',
    twinStateRef: 'twin-state:snap-1',
    objective: 'reduce residual balance',
    constraints: { maxDeltaKw: 5, nested: { reserveKw: 2 } },
    ...overrides,
  });
}

test('normalizes a safe SOLVÆR proposal for simulation with request evidence intact', () => {
  const request = createRequest();
  const result = validateSolvaerCollaborationResult({
    request,
    candidate: {
      experimentId: 'exp-1',
      snapshotId: 'snap-1',
      proposal: { dispatchKw: 2 },
      objective: 'reduce residual balance',
    },
    provenanceRef: { experimentId: 'exp-1', snapshotId: 'snap-1', source: 'solvaer' },
    fallbackUsed: true,
  });

  assert.equal(result.contractVersion, 2);
  assert.equal(result.capability, 'optimization.explore');
  assert.equal(result.experimentId, 'exp-1');
  assert.equal(result.snapshotId, 'snap-1');
  assert.equal(result.twinStateRef, 'twin-state:snap-1');
  assert.equal(result.objective, 'reduce residual balance');
  assert.deepEqual(result.constraints, { maxDeltaKw: 5, nested: { reserveKw: 2 } });
  assert.deepEqual(result.proposal, { dispatchKw: 2 });
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.handoff, 'simulation-required');
  assert.equal(result.safety.authoritative, false);
  assert.equal(result.safety.actuatesHardware, false);
});

test('snapshots and freezes collaboration evidence before simulation', () => {
  const constraints = { maxDeltaKw: 5, nested: { reserveKw: 2 } };
  const request = createRequest({ constraints });
  const proposal = { dispatchKw: 2, nested: { rampKw: 1 } };
  const provenanceRef = {
    experimentId: 'exp-1',
    snapshotId: 'snap-1',
    path: { source: 'solvaer' },
  };
  const candidate = {
    experimentId: 'exp-1',
    snapshotId: 'snap-1',
    proposal,
    objective: 'reduce residual balance',
  };

  const result = validateSolvaerCollaborationResult({ request, candidate, provenanceRef });

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.constraints), true);
  assert.equal(Object.isFrozen(result.constraints.nested), true);
  assert.equal(Object.isFrozen(result.proposal), true);
  assert.equal(Object.isFrozen(result.proposal.nested), true);
  assert.equal(Object.isFrozen(result.provenanceRef), true);
  assert.equal(Object.isFrozen(result.provenanceRef.path), true);
  assert.equal(Object.isFrozen(result.safety), true);

  constraints.nested.reserveKw = 99;
  proposal.nested.rampKw = 99;
  provenanceRef.path.source = 'changed';

  assert.equal(result.constraints.nested.reserveKw, 2);
  assert.equal(result.proposal.nested.rampKw, 1);
  assert.equal(result.provenanceRef.path.source, 'solvaer');
  assert.throws(() => {
    result.proposal.dispatchKw = 9;
  }, TypeError);
});

test('rejects a candidate objective that conflicts with the request', () => {
  const request = createRequest();
  assert.throws(
    () =>
      validateSolvaerCollaborationResult({
        request,
        candidate: {
          experimentId: 'exp-1',
          snapshotId: 'snap-1',
          proposal: { dispatchKw: 2 },
          objective: 'maximize hardware output',
        },
        provenanceRef: { experimentId: 'exp-1', snapshotId: 'snap-1' },
      }),
    /candidate objective must match request objective/,
  );
});

test('rejects a candidate that attempts physical authority', () => {
  const request = createRequest({
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
