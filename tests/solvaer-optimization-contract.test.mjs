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
    twinStateRef: 'twin-001',
    objective: 'minimize residual balance',
    constraints: { exportLimitKw: 40 },
    ...overrides,
  });
}

function createProvenance(overrides = {}) {
  return {
    experimentId: 'experiment-001',
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-001',
    source: 'solvaer-phase-1',
    ...overrides,
  };
}

test('creates an advisory SOLVÆR optimization request', () => {
  const request = createRequest();
  assert.equal(request.contractVersion, 1);
  assert.equal(request.capability, 'optimization.explore');
  assert.equal(request.safety.advisoryOnly, true);
  assert.equal(request.safety.authoritative, false);
  assert.equal(request.safety.actuatesHardware, false);
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.constraints), true);
  assert.equal(Object.isFrozen(request.safety), true);
});

test('accepts a candidate only as an immutable simulation-required handoff', () => {
  const request = createRequest();
  const candidate = {
    batteryPowerKw: 8,
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-001',
  };
  const provenanceRef = createProvenance();
  const accepted = acceptSolvaerOptimizationResult({
    request,
    candidate,
    provenanceRef,
  });

  assert.deepEqual(accepted.candidate, candidate);
  assert.equal(accepted.snapshotId, 'snapshot-001');
  assert.equal(accepted.twinStateRef, 'twin-001');
  assert.equal(accepted.objective, 'minimize residual balance');
  assert.deepEqual(accepted.constraints, { exportLimitKw: 40 });
  assert.equal(accepted.handoff, 'simulation-required');
  assert.equal(accepted.safety.authoritative, false);
  assert.equal(accepted.safety.actuatesHardware, false);
  assert.equal(Object.isFrozen(accepted), true);
  assert.equal(Object.isFrozen(accepted.candidate), true);
  assert.equal(Object.isFrozen(accepted.provenanceRef), true);
  assert.equal(Object.isFrozen(accepted.safety), true);
});

test('isolates accepted evidence from later caller mutation', () => {
  const constraints = { exportLimitKw: 40, reserve: { minimumKw: 5 } };
  const request = createRequest({ constraints });
  const candidate = { batteryPowerKw: 8, metadata: { solver: 'phase-1' } };
  const provenanceRef = createProvenance({ trace: { run: 'r1' } });
  const accepted = acceptSolvaerOptimizationResult({
    request,
    candidate,
    provenanceRef,
    fallbackUsed: true,
  });

  constraints.reserve.minimumKw = 99;
  candidate.metadata.solver = 'tampered';
  provenanceRef.trace.run = 'r2';

  assert.equal(accepted.constraints.reserve.minimumKw, 5);
  assert.equal(accepted.candidate.metadata.solver, 'phase-1');
  assert.equal(accepted.provenanceRef.trace.run, 'r1');
  assert.equal(accepted.fallbackUsed, true);
  assert.throws(() => {
    accepted.candidate.batteryPowerKw = 100;
  }, TypeError);
});

test('rejects candidates from a different experiment', () => {
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
});

test('rejects candidates or provenance from a different snapshot', () => {
  const request = createRequest();
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
        provenanceRef: createProvenance({ snapshotId: 'snapshot-002' }),
      }),
    /snapshotId must match request/,
  );
});

test('rejects candidates or provenance from a different twin state', () => {
  const request = createRequest();
  assert.throws(
    () =>
      acceptSolvaerOptimizationResult({
        request,
        candidate: { batteryPowerKw: 8, twinStateRef: 'twin-002' },
        provenanceRef: createProvenance(),
      }),
    /twinStateRef must match request/,
  );
  assert.throws(
    () =>
      acceptSolvaerOptimizationResult({
        request,
        candidate: { batteryPowerKw: 8 },
        provenanceRef: createProvenance({ twinStateRef: 'twin-002' }),
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
