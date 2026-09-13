import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acceptSolvaerOptimizationResult,
  createSolvaerOptimizationRequest,
} from '../src/solvaer-optimization-contract.mjs';

function buildRequest(overrides = {}) {
  return createSolvaerOptimizationRequest({
    experimentId: 'experiment-001',
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-001',
    objective: 'minimize residual balance',
    constraints: { exportLimitKw: 40, nested: { reserveKw: 12 } },
    ...overrides,
  });
}

function provenance(overrides = {}) {
  return {
    experimentId: 'experiment-001',
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-001',
    source: 'solvaer-phase-1',
    ...overrides,
  };
}

test('creates an immutable advisory SOLVÆR optimization request', () => {
  const constraints = { exportLimitKw: 40, nested: { reserveKw: 12 } };
  const request = buildRequest({ constraints });

  constraints.exportLimitKw = 999;
  constraints.nested.reserveKw = 1;

  assert.equal(request.contractVersion, 1);
  assert.equal(request.capability, 'optimization.explore');
  assert.equal(request.constraints.exportLimitKw, 40);
  assert.equal(request.constraints.nested.reserveKw, 12);
  assert.equal(request.safety.advisoryOnly, true);
  assert.equal(request.safety.authoritative, false);
  assert.equal(request.safety.actuatesHardware, false);
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.constraints), true);
  assert.equal(Object.isFrozen(request.constraints.nested), true);
  assert.equal(Object.isFrozen(request.safety), true);
});

test('accepts a candidate only as an immutable simulation-required handoff', () => {
  const request = buildRequest();
  const candidate = { batteryPowerKw: 8, schedule: [{ minute: 15, powerKw: 8 }] };
  const provenanceRef = provenance();
  const accepted = acceptSolvaerOptimizationResult({
    request,
    candidate,
    provenanceRef,
  });

  candidate.batteryPowerKw = 99;
  candidate.schedule[0].powerKw = 99;
  provenanceRef.source = 'tampered-source';

  assert.deepEqual(accepted.candidate, {
    batteryPowerKw: 8,
    schedule: [{ minute: 15, powerKw: 8 }],
  });
  assert.equal(accepted.experimentId, 'experiment-001');
  assert.equal(accepted.snapshotId, 'snapshot-001');
  assert.equal(accepted.twinStateRef, 'twin-001');
  assert.equal(accepted.objective, 'minimize residual balance');
  assert.equal(accepted.constraints.exportLimitKw, 40);
  assert.equal(accepted.provenanceRef.source, 'solvaer-phase-1');
  assert.equal(accepted.handoff, 'simulation-required');
  assert.equal(accepted.safety.authoritative, false);
  assert.equal(accepted.safety.actuatesHardware, false);
  assert.equal(Object.isFrozen(accepted), true);
  assert.equal(Object.isFrozen(accepted.candidate.schedule), true);
  assert.equal(Object.isFrozen(accepted.provenanceRef), true);
  assert.equal(Object.isFrozen(accepted.safety), true);
});

test('rejects candidates whose experiment, snapshot, or twin-state provenance does not match', () => {
  const request = buildRequest();
  const mismatches = [
    ['experimentId', 'experiment-002'],
    ['snapshotId', 'snapshot-002'],
    ['twinStateRef', 'twin-002'],
  ];

  for (const [field, value] of mismatches) {
    assert.throws(
      () =>
        acceptSolvaerOptimizationResult({
          request,
          candidate: { batteryPowerKw: 8 },
          provenanceRef: provenance({ [field]: value }),
        }),
      /must match request/,
      field,
    );
  }
});

test('rejects a request whose safety boundary was replaced before acceptance', () => {
  const request = {
    ...buildRequest(),
    safety: { advisoryOnly: false, authoritative: true, actuatesHardware: true },
  };

  assert.throws(
    () =>
      acceptSolvaerOptimizationResult({
        request,
        candidate: { batteryPowerKw: 8 },
        provenanceRef: provenance(),
      }),
    /must remain advisory and non-authoritative/,
  );
});

test('preserves explicit fallback disclosure without changing simulation-only authority', () => {
  const accepted = acceptSolvaerOptimizationResult({
    request: buildRequest(),
    candidate: { batteryPowerKw: 4 },
    provenanceRef: provenance(),
    fallbackUsed: true,
  });

  assert.equal(accepted.fallbackUsed, true);
  assert.equal(accepted.handoff, 'simulation-required');
  assert.equal(accepted.safety.authoritative, false);
  assert.equal(accepted.safety.actuatesHardware, false);
});
