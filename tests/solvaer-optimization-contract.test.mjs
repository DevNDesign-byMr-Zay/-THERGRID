import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSolvaerOptimizationRequest,
  acceptSolvaerOptimizationResult,
} from '../src/solvaer-optimization-contract.mjs';

test('creates an advisory SOLVÆR optimization request', () => {
  const request = createSolvaerOptimizationRequest({
    experimentId: 'experiment-001',
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-001',
    objective: 'minimize residual balance',
    constraints: { exportLimitKw: 40 },
  });
  assert.equal(request.contractVersion, 1);
  assert.equal(request.capability, 'optimization.explore');
  assert.equal(request.safety.advisoryOnly, true);
  assert.equal(request.safety.authoritative, false);
  assert.equal(request.safety.actuatesHardware, false);
});

test('accepts a candidate only as a simulation-required handoff', () => {
  const request = createSolvaerOptimizationRequest({
    experimentId: 'experiment-001',
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-001',
    objective: 'minimize residual balance',
  });
  const accepted = acceptSolvaerOptimizationResult({
    request,
    candidate: { batteryPowerKw: 8, snapshotId: 'snapshot-001' },
    provenanceRef: { experimentId: 'experiment-001', snapshotId: 'snapshot-001', source: 'solvaer-phase-1' },
  });
  assert.deepEqual(accepted.candidate, { batteryPowerKw: 8, snapshotId: 'snapshot-001' });
  assert.equal(accepted.snapshotId, 'snapshot-001');
  assert.equal(accepted.handoff, 'simulation-required');
  assert.equal(accepted.safety.authoritative, false);
  assert.equal(accepted.safety.actuatesHardware, false);
});

test('rejects candidates from a different experiment', () => {
  const request = createSolvaerOptimizationRequest({
    experimentId: 'experiment-001',
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-001',
    objective: 'minimize residual balance',
  });
  assert.throws(
    () => acceptSolvaerOptimizationResult({
      request,
      candidate: { batteryPowerKw: 8 },
      provenanceRef: { experimentId: 'experiment-002' },
    }),
    /must match request/,
  );
});

test('rejects candidates or provenance from a different snapshot', () => {
  const request = createSolvaerOptimizationRequest({
    experimentId: 'experiment-001',
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-001',
    objective: 'minimize residual balance',
  });
  assert.throws(
    () => acceptSolvaerOptimizationResult({
      request,
      candidate: { batteryPowerKw: 8, snapshotId: 'snapshot-002' },
      provenanceRef: { experimentId: 'experiment-001', snapshotId: 'snapshot-001' },
    }),
    /snapshotId must match request/,
  );
  assert.throws(
    () => acceptSolvaerOptimizationResult({
      request,
      candidate: { batteryPowerKw: 8 },
      provenanceRef: { experimentId: 'experiment-001', snapshotId: 'snapshot-002' },
    }),
    /snapshotId must match request/,
  );
});
