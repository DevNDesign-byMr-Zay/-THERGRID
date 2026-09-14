import test from 'node:test';
import assert from 'node:assert/strict';

import { createSolvaerSimulationEvidence } from '../src/solvaer-simulation-evidence.mjs';
import {
  createSolvaerSimulationOperatorProjection,
  validateSolvaerSimulationOperatorProjection,
} from '../src/solvaer-simulation-operator-projection.mjs';

function source() {
  return {
    accepted: {
      requestId: 'solvaer:experiment-1:snapshot-1',
      experimentId: 'experiment-1',
      snapshotId: 'snapshot-1',
    },
    collaborationEvidenceRef: {
      evidenceFingerprint: 'a'.repeat(64),
      requestId: 'solvaer:experiment-1:snapshot-1',
      experimentId: 'experiment-1',
      snapshotId: 'snapshot-1',
    },
    simulation: {
      schemaVersion: 2,
      backend: 'thergrid-classical-reference-v1',
      deterministic: true,
      seed: 0,
      status: 'passed',
      runtimeMs: 0,
      snapshotId: 'snapshot-1',
      durationMinutes: 15,
      inputs: {
        currentGridKw: 2,
        targetGridKw: 1,
        projectedBalanceKw: 0.5,
      },
      outputs: {
        residualBalanceKw: -0.5,
        gridAdjustmentKw: -1,
      },
      safety: {
        physicalActuation: false,
        advisoryOnly: true,
      },
    },
  };
}

function fixture() {
  const evidenceSource = source();
  const evidence = createSolvaerSimulationEvidence(evidenceSource);
  return { evidenceSource, evidence };
}

test('projects only operator-relevant validated simulation evidence', () => {
  const { evidenceSource, evidence } = fixture();
  const projection = createSolvaerSimulationOperatorProjection({
    evidence,
    source: evidenceSource,
  });

  assert.deepEqual(projection.identity, {
    requestId: 'solvaer:experiment-1:snapshot-1',
    experimentId: 'experiment-1',
    snapshotId: 'snapshot-1',
  });
  assert.deepEqual(projection.simulation, {
    backend: 'thergrid-classical-reference-v1',
    status: 'passed',
    deterministic: true,
    durationMinutes: 15,
    runtimeMs: 0,
  });
  assert.deepEqual(projection.metrics, {
    residualBalanceKw: -0.5,
    gridAdjustmentKw: -1,
  });
  assert.equal(projection.promotionEligible, false);
  assert.equal(projection.interpretation, 'operator-review-only');
  assert.deepEqual(projection.safety, {
    advisoryOnly: true,
    authoritative: false,
    deploysInfrastructure: false,
    dispatchesInfrastructure: false,
    promotesCandidate: false,
    actuatesHardware: false,
  });
  assert.equal('candidate' in projection, false);
  assert.equal('action' in projection, false);
  assert.equal(validateSolvaerSimulationOperatorProjection(projection, {
    evidence,
    source: evidenceSource,
  }), true);
});

test('projection identity is deterministic and recursively immutable', () => {
  const { evidenceSource, evidence } = fixture();
  const first = createSolvaerSimulationOperatorProjection({ evidence, source: evidenceSource });
  const second = createSolvaerSimulationOperatorProjection({ evidence, source: evidenceSource });

  assert.equal(first.projectionFingerprint, second.projectionFingerprint);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.identity), true);
  assert.equal(Object.isFrozen(first.evidenceRefs), true);
  assert.equal(Object.isFrozen(first.simulation), true);
  assert.equal(Object.isFrozen(first.metrics), true);
  assert.equal(Object.isFrozen(first.safety), true);
});

test('rejects source drift before operator projection', () => {
  const { evidenceSource, evidence } = fixture();

  assert.throws(
    () => createSolvaerSimulationOperatorProjection({
      evidence,
      source: {
        ...evidenceSource,
        simulation: {
          ...evidenceSource.simulation,
          outputs: {
            ...evidenceSource.simulation.outputs,
            residualBalanceKw: 999,
          },
        },
      },
    }),
    /validated SOLVÆR simulation evidence is required/,
  );
});

test('tampered operator metrics or promotion authority fail validation', () => {
  const { evidenceSource, evidence } = fixture();
  const projection = createSolvaerSimulationOperatorProjection({ evidence, source: evidenceSource });

  assert.equal(
    validateSolvaerSimulationOperatorProjection(
      {
        ...projection,
        metrics: { ...projection.metrics, residualBalanceKw: 999 },
      },
      { evidence, source: evidenceSource },
    ),
    false,
  );
  assert.equal(
    validateSolvaerSimulationOperatorProjection(
      {
        ...projection,
        safety: { ...projection.safety, promotesCandidate: true },
      },
      { evidence, source: evidenceSource },
    ),
    false,
  );
});
