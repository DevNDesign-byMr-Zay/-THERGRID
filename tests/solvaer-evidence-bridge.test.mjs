import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { evaluateSolvaerDecisionHandoff } from '../src/solvaer-decision-handoff.mjs';
import {
  createSolvaerEvidenceBridge,
  validateSolvaerEvidenceBridge,
} from '../src/solvaer-evidence-bridge.mjs';

const fixture = {
  schemaVersion: 1,
  snapshotId: 'synthetic-v1',
  observedAt: '2026-09-13T00:00:00.000Z',
  assets: [
    { id: 'solar-1', kind: 'solar', powerKw: 40, capacityKw: 50 },
    { id: 'wind-1', kind: 'wind', powerKw: 20, capacityKw: 30 },
    {
      id: 'battery-1',
      kind: 'battery',
      powerKw: 0,
      capacityKw: 25,
      capacityKwh: 100,
      stateOfChargeKwh: 60,
    },
    { id: 'load-1', kind: 'load', powerKw: 45, flexible: true },
    { id: 'grid-1', kind: 'grid_interconnect', powerKw: -15, importLimitKw: 80, exportLimitKw: 40 },
  ],
  topology: {
    nodes: ['node-a'],
    connections: [
      { assetId: 'solar-1', nodeId: 'node-a' },
      { assetId: 'wind-1', nodeId: 'node-a' },
      { assetId: 'battery-1', nodeId: 'node-a' },
      { assetId: 'load-1', nodeId: 'node-a' },
      { assetId: 'grid-1', nodeId: 'node-a' },
    ],
  },
};

test('creates verifiable SOLVÆR evidence after simulation', () => {
  const baseline = runSyntheticMicrogrid(fixture);
  const handoff = evaluateSolvaerDecisionHandoff({
    request: baseline.solvaerRequest,
    candidate: {
      experimentId: baseline.experimentId,
      snapshotId: fixture.snapshotId,
      proposal: baseline.proposal,
    },
    provenanceRef: { experimentId: baseline.experimentId, snapshotId: fixture.snapshotId },
    twinState: baseline.twinState,
    forecast: baseline.forecast,
    proposal: baseline.proposal,
  });
  const evidence = createSolvaerEvidenceBridge({
    request: baseline.solvaerRequest,
    candidate: handoff.candidate.candidate,
    provenanceRef: { experimentId: baseline.experimentId, snapshotId: fixture.snapshotId },
    simulation: handoff.simulation,
    decisionReceipt: handoff.decisionReceipt,
  });
  assert.equal(evidence.experimentId, baseline.experimentId);
  assert.equal(evidence.simulationStatus, 'passed');
  assert.equal(evidence.handoff, 'simulation-required');
  assert.equal(evidence.safety.authoritative, false);
  assert.equal(validateSolvaerEvidenceBridge(evidence), true);
});

test('rejects tampered SOLVÆR evidence', () => {
  const baseline = runSyntheticMicrogrid(fixture);
  const evidence = createSolvaerEvidenceBridge({
    request: baseline.solvaerRequest,
    candidate: {
      experimentId: baseline.experimentId,
      snapshotId: fixture.snapshotId,
      proposal: baseline.proposal,
    },
    provenanceRef: { experimentId: baseline.experimentId, snapshotId: fixture.snapshotId },
    simulation: baseline.simulation,
    decisionReceipt: baseline.receipt,
  });
  assert.equal(validateSolvaerEvidenceBridge({ ...evidence, receiptId: 'tampered' }), false);
  assert.equal(
    validateSolvaerEvidenceBridge({
      ...evidence,
      safety: { authoritative: true, actuatesHardware: false, advisoryOnly: true },
    }),
    false,
  );
});
