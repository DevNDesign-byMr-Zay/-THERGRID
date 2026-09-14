import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSolvaerOptimizationRequest,
  acceptSolvaerOptimizationResult,
} from '../src/solvaer-optimization-contract.mjs';

function createRequest(overrides = {}) {
  return createSolvaerOptimizationRequest({
    experimentId: 'experiment-001',
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-state:snapshot-001',
    objective: 'minimize residual balance',
    constraints: { exportLimitKw: 40 },
    ...overrides,
  });
}

test('creates an advisory SOLVÆR v2 optimization request bound to its twin snapshot', () => {
  const request = createRequest();
  assert.equal(request.contractVersion, 2);
  assert.equal(request.capability, 'optimization.explore');
  assert.equal(request.requestId, 'solvaer:experiment-001:snapshot-001');
  assert.equal(request.snapshotId, 'snapshot-001');
  assert.equal(request.twinStateRef, 'twin-state:snapshot-001');
  assert.equal(request.safety.advisoryOnly, true);
  assert.equal(request.safety.authoritative, false);
  assert.equal(request.safety.actuatesHardware, false);
});

test('preserves an explicit non-empty request identity', () => {
  const request = createRequest({ requestId: 'request-custom-001' });
  assert.equal(request.requestId, 'request-custom-001');
});

test('rejects a request whose twin reference does not bind to its snapshot', () => {
  assert.throws(
    () => createRequest({ twinStateRef: 'twin-state:snapshot-002' }),
    /twinStateRef must bind to snapshotId/,
  );
});

test('accepts a candidate only as a simulation-required handoff', () => {
  const request = createRequest();
  const accepted = acceptSolvaerOptimizationResult({
    request,
    candidate: { batteryPowerKw: 8, snapshotId: 'snapshot-001' },
    provenanceRef: {
      experimentId: 'experiment-001',
      snapshotId: 'snapshot-001',
      source: 'solvaer-phase-1',
    },
  });
  assert.deepEqual(accepted.candidate, {
    batteryPowerKw: 8,
    snapshotId: 'snapshot-001',
  });
  assert.equal(accepted.requestId, request.requestId);
  assert.equal(accepted.snapshotId, 'snapshot-001');
  assert.equal(accepted.handoff, 'simulation-required');
  assert.equal(accepted.safety.authoritative, false);
  assert.equal(accepted.safety.actuatesHardware, false);
});

test('rejects candidates that claim authority or physical actuation', () => {
  const request = createRequest();
  for (const candidate of [
    { authoritative: true },
    { actuatesHardware: true },
    { physicalActuation: true },
  ]) {
    assert.throws(
      () =>
        acceptSolvaerOptimizationResult({
          request,
          candidate,
          provenanceRef: { experimentId: 'experiment-001', snapshotId: 'snapshot-001' },
        }),
      /cannot claim authority or physical actuation/,
    );
  }
});

test('rejects candidates from a different experiment', () => {
  const request = createRequest();
  assert.throws(
    () =>
      acceptSolvaerOptimizationResult({
        request,
        candidate: { batteryPowerKw: 8 },
        provenanceRef: { experimentId: 'experiment-002' },
      }),
    /must match request/,
  );
});

test('rejects candidates or provenance from a different snapshot', () => {
  const request = createRequest();
  assert.throws(
    () =>
      acceptSolvaerOptimizationResult({
        request,
        candidate: { batteryPowerKw: 8, snapshotId: 'snapshot-002' },
        provenanceRef: {
          experimentId: 'experiment-001',
          snapshotId: 'snapshot-001',
        },
      }),
    /snapshotId must match request/,
  );
  assert.throws(
    () =>
      acceptSolvaerOptimizationResult({
        request,
        candidate: { batteryPowerKw: 8 },
        provenanceRef: {
          experimentId: 'experiment-001',
          snapshotId: 'snapshot-002',
        },
      }),
    /snapshotId must match request/,
  );
});
