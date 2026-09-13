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

function createProvenance(overrides = {}) {
  return {
    experimentId: 'experiment-001',
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-state:snapshot-001',
    source: 'solvaer-phase-1',
    ...overrides,
  };
}

test('creates an immutable advisory SOLVÆR optimization request', () => {
  const constraints = { exportLimitKw: 40, reserve: { minimumKw: 5 } };
  const request = createRequest({ constraints });

  constraints.reserve.minimumKw = 99;

  assert.equal(request.contractVersion, 1);
  assert.equal(request.capability, 'optimization.explore');
  assert.equal(request.constraints.reserve.minimumKw, 5);
  assert.equal(request.safety.advisoryOnly, true);
  assert.equal(request.safety.authoritative, false);
  assert.equal(request.safety.actuatesHardware, false);
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.constraints), true);
  assert.equal(Object.isFrozen(request.constraints.reserve), true);
  assert.equal(Object.isFrozen(request.safety), true);
});

test('accepts a candidate only as immutable simulation-required evidence', () => {
  const request = createRequest();
  const candidate = {
    batteryPowerKw: 8,
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-state:snapshot-001',
    metadata: { solver: 'phase-1' },
  };
  const provenanceRef = createProvenance({ trace: { run: 'r1' } });
  const accepted = acceptSolvaerOptimizationResult({
    request,
    candidate,
    provenanceRef,
    fallbackUsed: true,
  });

  candidate.metadata.solver = 'tampered';
  provenanceRef.trace.run = 'r2';

  assert.equal(accepted.experimentId, 'experiment-001');
  assert.equal(accepted.snapshotId, 'snapshot-001');
  assert.equal(accepted.twinStateRef, 'twin-state:snapshot-001');
  assert.equal(accepted.objective, 'minimize residual balance');
  assert.deepEqual(accepted.constraints, { exportLimitKw: 40 });
  assert.equal(accepted.candidate.metadata.solver, 'phase-1');
  assert.equal(accepted.provenanceRef.trace.run, 'r1');
  assert.equal(accepted.fallbackUsed, true);
  assert.equal(accepted.handoff, 'simulation-required');
  assert.equal(Object.isFrozen(accepted), true);
  assert.equal(Object.isFrozen(accepted.candidate), true);
  assert.equal(Object.isFrozen(accepted.provenanceRef), true);
  assert.equal(Object.isFrozen(accepted.safety), true);
});

test('accepts the full provenance graph shape while preserving request identities', () => {
  const request = createRequest();
  const accepted = acceptSolvaerOptimizationResult({
    request,
    candidate: { batteryPowerKw: 8 },
    provenanceRef: {
      contractVersion: 2,
      experimentId: 'experiment-001',
      nodes: [{ type: 'twin-state', id: 'twin-state-abc' }],
      edges: [],
    },
  });

  assert.equal(accepted.twinStateRef, 'twin-state:snapshot-001');
  assert.equal(accepted.provenanceRef.contractVersion, 2);
  assert.equal(Object.isFrozen(accepted.provenanceRef.nodes), true);
});

test('rejects mismatched experiment, snapshot, or twin-state identities', () => {
  const request = createRequest();

  assert.throws(
    () =>
      acceptSolvaerOptimizationResult({
        request,
        candidate: { batteryPowerKw: 8 },
        provenanceRef: createProvenance({ experimentId: 'experiment-002' }),
      }),
    /experimentId must match request/,
  );
  assert.throws(
    () =>
      acceptSolvaerOptimizationResult({
        request,
        candidate: { batteryPowerKw: 8, snapshotId: 'snapshot-002' },
        provenanceRef: createProvenance(),
      }),
    /snapshotId must match request/,
  );
  assert.throws(
    () =>
      acceptSolvaerOptimizationResult({
        request,
        candidate: { batteryPowerKw: 8 },
        provenanceRef: createProvenance({ twinStateRef: 'twin-state:snapshot-002' }),
      }),
    /twinStateRef must match request/,
  );
});

test('rejects a request whose advisory safety boundary was replaced', () => {
  const request = {
    ...createRequest(),
    safety: {
      advisoryOnly: false,
      authoritative: true,
      actuatesHardware: true,
    },
  };

  assert.throws(
    () =>
      acceptSolvaerOptimizationResult({
        request,
        candidate: { batteryPowerKw: 8 },
        provenanceRef: createProvenance(),
      }),
    /safety boundary is invalid/,
  );
});
