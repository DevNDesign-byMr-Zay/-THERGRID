import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acceptSolvaerOptimizationResult,
  createSolvaerOptimizationRequest,
} from '../src/solvaer-optimization-contract.mjs';
import { simulateSolvaerOptimizationHandoff } from '../src/solvaer-simulation-gate.mjs';

const twinState = {
  schemaVersion: 1,
  snapshotId: 'snapshot-001',
  totals: {
    generationKw: 40,
    loadKw: 45,
    batteryKw: 0,
    gridKw: -15,
    balanceKw: -20,
    renewableSharePercent: 88.888889,
  },
};

function acceptedHandoff(overrides = {}) {
  const request = createSolvaerOptimizationRequest({
    experimentId: 'experiment-001',
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-001',
    objective: 'minimize residual balance',
    constraints: { exportLimitKw: 40 },
  });

  return acceptSolvaerOptimizationResult({
    request,
    candidate: {
      targetGridKw: -5,
      projectedBalanceKw: -20,
      rationale: 'reduce residual imbalance before policy review',
    },
    provenanceRef: {
      experimentId: 'experiment-001',
      snapshotId: 'snapshot-001',
      twinStateRef: 'twin-001',
      source: 'solvaer-phase-1',
    },
    ...overrides,
  });
}

test('runs an accepted SOLVÆR candidate through deterministic simulation only', () => {
  const result = simulateSolvaerOptimizationHandoff({
    handoff: acceptedHandoff(),
    twinState,
    twinStateRef: 'twin-001',
  });

  assert.equal(result.simulation.status, 'passed');
  assert.equal(result.simulation.snapshotId, 'snapshot-001');
  assert.equal(result.simulation.outputs.gridAdjustmentKw, 10);
  assert.equal(result.simulation.outputs.residualBalanceKw, -10);
  assert.equal(result.promotionAuthorized, false);
  assert.equal(result.nextGate, 'policy-validation');
  assert.equal(result.safety.authoritative, false);
  assert.equal(result.safety.actuatesHardware, false);
  assert.equal(result.safety.physicalActuation, false);
});

test('rejects simulation against another snapshot or twin-state identity', () => {
  assert.throws(
    () =>
      simulateSolvaerOptimizationHandoff({
        handoff: acceptedHandoff(),
        twinState: { ...twinState, snapshotId: 'snapshot-other' },
        twinStateRef: 'twin-001',
      }),
    /snapshotId must match twinState.snapshotId/,
  );

  assert.throws(
    () =>
      simulateSolvaerOptimizationHandoff({
        handoff: acceptedHandoff(),
        twinState,
        twinStateRef: 'twin-other',
      }),
    /twinStateRef must match simulation twinStateRef/,
  );
});

test('rejects a handoff whose advisory authority boundary was replaced', () => {
  const handoff = {
    ...acceptedHandoff(),
    safety: { advisoryOnly: false, authoritative: true, actuatesHardware: true },
  };

  assert.throws(
    () =>
      simulateSolvaerOptimizationHandoff({
        handoff,
        twinState,
        twinStateRef: 'twin-001',
      }),
    /must remain advisory and non-authoritative/,
  );
});

test('requires an explicit finite grid target for the classical simulation adapter', () => {
  const request = createSolvaerOptimizationRequest({
    experimentId: 'experiment-001',
    snapshotId: 'snapshot-001',
    twinStateRef: 'twin-001',
    objective: 'minimize residual balance',
  });
  const handoff = acceptSolvaerOptimizationResult({
    request,
    candidate: { batteryPowerKw: 8 },
    provenanceRef: {
      experimentId: 'experiment-001',
      snapshotId: 'snapshot-001',
      twinStateRef: 'twin-001',
    },
  });

  assert.throws(
    () =>
      simulateSolvaerOptimizationHandoff({ handoff, twinState, twinStateRef: 'twin-001' }),
    /targetGridKw must be finite/,
  );
});

test('freezes simulation evidence before the next policy gate', () => {
  const result = simulateSolvaerOptimizationHandoff({
    handoff: acceptedHandoff(),
    twinState,
    twinStateRef: 'twin-001',
  });

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.candidate), true);
  assert.equal(Object.isFrozen(result.simulation), true);
  assert.equal(Object.isFrozen(result.simulation.outputs), true);
  assert.equal(Object.isFrozen(result.safety), true);
  assert.throws(() => {
    result.promotionAuthorized = true;
  }, TypeError);
});
