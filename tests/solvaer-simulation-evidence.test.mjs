import test from 'node:test';
import assert from 'node:assert/strict';

import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { evaluateSolvaerCandidate } from '../src/solvaer-simulation-gateway.mjs';
import {
  createSolvaerSimulationEvidence,
  validateSolvaerSimulationEvidence,
} from '../src/solvaer-simulation-evidence.mjs';

function snapshot(snapshotId) {
  return {
    schemaVersion: 1,
    snapshotId,
    observedAt: '2026-09-13T00:00:00.000Z',
    assets: [
      { id: 'solar-1', kind: 'solar', powerKw: 12, capacityKw: 15 },
      { id: 'load-1', kind: 'load', powerKw: 10, flexible: true },
      {
        id: 'grid-1',
        kind: 'grid_interconnect',
        powerKw: -2,
        importLimitKw: 80,
        exportLimitKw: 40,
      },
    ],
    topology: {
      nodes: ['node-a'],
      connections: [
        { assetId: 'solar-1', nodeId: 'node-a' },
        { assetId: 'load-1', nodeId: 'node-a' },
        { assetId: 'grid-1', nodeId: 'node-a' },
      ],
    },
  };
}

function evaluateFixture(snapshotId = 'snapshot-solvaer-evidence') {
  const input = snapshot(snapshotId);
  const pipeline = runSyntheticMicrogrid(input);
  const candidate = {
    experimentId: pipeline.experimentId,
    snapshotId: input.snapshotId,
    dispatchDeltaKw: 0.25,
  };
  const provenanceRef = {
    experimentId: pipeline.experimentId,
    snapshotId: input.snapshotId,
  };
  const collaborationEvidence = createSolvaerCollaborationEvidence({
    request: pipeline.solvaerRequest,
    candidate,
    provenanceRef,
  });
  const evaluation = evaluateSolvaerCandidate({
    request: pipeline.solvaerRequest,
    candidate,
    provenanceRef,
    collaborationEvidence,
    twinState: pipeline.twinState,
    proposal: pipeline.proposal,
  });
  return { pipeline, evaluation };
}

test('gateway emits deterministic simulation evidence bound to the collaboration receipt', () => {
  const { evaluation } = evaluateFixture();
  const source = {
    accepted: evaluation.accepted,
    collaborationEvidenceRef: evaluation.collaborationEvidenceRef,
    simulation: evaluation.simulation,
  };

  assert.equal(
    evaluation.simulationEvidence.collaborationEvidenceFingerprint,
    evaluation.collaborationEvidenceRef.evidenceFingerprint,
  );
  assert.equal(evaluation.simulationEvidence.requestId, evaluation.accepted.requestId);
  assert.equal(evaluation.simulationEvidence.snapshotId, evaluation.accepted.snapshotId);
  assert.equal(evaluation.simulationEvidence.promotionEligible, false);
  assert.equal(evaluation.simulationEvidence.safety.promotesCandidate, false);
  assert.equal(validateSolvaerSimulationEvidence(evaluation.simulationEvidence, source), true);
  assert.equal(Object.isFrozen(evaluation.simulationEvidence), true);
  assert.equal(Object.isFrozen(evaluation.simulationEvidence.simulation), true);
  assert.equal(Object.isFrozen(evaluation.simulationEvidence.simulation.outputs), true);
});

test('simulation evidence snapshots caller-owned simulation state before fingerprinting', () => {
  const { evaluation } = evaluateFixture('snapshot-solvaer-mutation');
  const simulation = structuredClone(evaluation.simulation);
  const source = {
    accepted: evaluation.accepted,
    collaborationEvidenceRef: evaluation.collaborationEvidenceRef,
    simulation,
  };
  const evidence = createSolvaerSimulationEvidence(source);
  const originalResidual = evidence.simulation.outputs.residualBalanceKw;

  simulation.outputs.residualBalanceKw = 999;
  simulation.status = 'mutated';

  assert.equal(evidence.simulation.outputs.residualBalanceKw, originalResidual);
  assert.equal(evidence.simulation.status, 'passed');
  assert.equal(Object.isFrozen(evidence.simulation.outputs), true);
});

test('collaboration receipt identity participates in the simulation evidence fingerprint', () => {
  const { evaluation } = evaluateFixture('snapshot-solvaer-collaboration-identity');
  const source = {
    accepted: evaluation.accepted,
    collaborationEvidenceRef: evaluation.collaborationEvidenceRef,
    simulation: evaluation.simulation,
  };
  const changedReceiptSource = {
    ...source,
    collaborationEvidenceRef: {
      ...source.collaborationEvidenceRef,
      evidenceFingerprint: 'a'.repeat(64),
    },
  };

  const original = createSolvaerSimulationEvidence(source);
  const changed = createSolvaerSimulationEvidence(changedReceiptSource);

  assert.notEqual(original.simulationEvidenceFingerprint, changed.simulationEvidenceFingerprint);
  assert.equal(original.collaborationEvidenceFingerprint, source.collaborationEvidenceRef.evidenceFingerprint);
  assert.equal(changed.collaborationEvidenceFingerprint, 'a'.repeat(64));
  assert.equal(validateSolvaerSimulationEvidence(original, source), true);
  assert.equal(validateSolvaerSimulationEvidence(original, changedReceiptSource), false);
});

test('rejects cross-request collaboration references before issuing simulation evidence', () => {
  const { evaluation } = evaluateFixture('snapshot-solvaer-cross-request-evidence');

  assert.throws(
    () =>
      createSolvaerSimulationEvidence({
        accepted: evaluation.accepted,
        collaborationEvidenceRef: {
          ...evaluation.collaborationEvidenceRef,
          requestId: 'solvaer:other-request',
        },
        simulation: evaluation.simulation,
      }),
    /requestId must match accepted request/,
  );
});

test('rejects simulation authority or actuation claims', () => {
  const { evaluation } = evaluateFixture('snapshot-solvaer-authority-evidence');

  assert.throws(
    () =>
      createSolvaerSimulationEvidence({
        accepted: evaluation.accepted,
        collaborationEvidenceRef: evaluation.collaborationEvidenceRef,
        simulation: {
          ...evaluation.simulation,
          safety: { ...evaluation.simulation.safety, physicalActuation: true },
        },
      }),
    /simulation must remain deterministic, advisory-only, and non-actuating/,
  );
});

test('tampered simulation evidence fails validation even when the outer shape remains plausible', () => {
  const { evaluation } = evaluateFixture('snapshot-solvaer-tamper-evidence');
  const source = {
    accepted: evaluation.accepted,
    collaborationEvidenceRef: evaluation.collaborationEvidenceRef,
    simulation: evaluation.simulation,
  };

  assert.equal(
    validateSolvaerSimulationEvidence(
      {
        ...evaluation.simulationEvidence,
        simulation: {
          ...evaluation.simulationEvidence.simulation,
          outputs: {
            ...evaluation.simulationEvidence.simulation.outputs,
            residualBalanceKw: 999,
          },
        },
      },
      source,
    ),
    false,
  );
  assert.equal(
    validateSolvaerSimulationEvidence(
      {
        ...evaluation.simulationEvidence,
        safety: { ...evaluation.simulationEvidence.safety, promotesCandidate: true },
      },
      source,
    ),
    false,
  );
});
