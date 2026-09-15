import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { validateSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { buildSolvaerDecisionRenderBridge } from '../src/solvaer-decision-render-bridge.mjs';
import { validateSolvaerOperatorAttention } from '../src/solvaer-operator-attention.mjs';
import { validateHolographicRenderPacket } from '../src/holographic-renderer-contract.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'snapshot-bridge-001',
  observedAt: '2026-09-13T12:00:00Z',
  assets: [
    { id: 'load-1', kind: 'load', powerKw: 78 },
    { id: 'solar-1', kind: 'solar', powerKw: 48, capacityKw: 60 },
  ],
  topology: {
    nodes: ['node-load', 'node-solar'],
    connections: [{ assetId: 'load-1', nodeId: 'node-load' }, { assetId: 'solar-1', nodeId: 'node-solar' }],
  },
};

test('SOLVÆR decision bridge preserves experiment evidence through rendering and operator attention', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const candidate = { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId, proposal: baseline.proposal, forecast: baseline.forecast, rationale: 'explore a simulation-bound candidate' };
  const bridge = buildSolvaerDecisionRenderBridge({ request: baseline.solvaerRequest, candidate, provenanceRef: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId }, twinState: baseline.twinState, forecast: baseline.forecast, proposal: baseline.proposal, scene: baseline.scene, presentation: baseline.presentation });
  assert.equal(bridge.experimentId, baseline.experimentId);
  assert.equal(bridge.decision.simulation.status, 'passed');
  assert.equal(bridge.decision.promotionEligible, false);
  assert.equal(bridge.collaborationEvidence.experimentId, baseline.experimentId);
  assert.equal(validateSolvaerCollaborationEvidence(bridge.collaborationEvidence), true);
  assert.equal(bridge.operatorAttention.experimentId, baseline.experimentId);
  assert.equal(bridge.operatorAttention.snapshotId, snapshot.snapshotId);
  assert.equal(validateSolvaerOperatorAttention(bridge.operatorAttention), true);
  assert.equal(bridge.operatorAttention.items.length, 2);
  assert.equal(bridge.operatorAttention.items[0].evidenceRef, bridge.collaborationEvidence.evidenceFingerprint);
  assert.equal(bridge.renderPacket.experimentId, baseline.experimentId);
  assert.equal(bridge.renderPacket.receiptId, bridge.decision.decisionReceipt.receiptId);
  assert.equal(validateHolographicRenderPacket(bridge.renderPacket), true);
  assert.deepEqual(bridge.safety, { authoritative: false, actuatesHardware: false, advisoryOnly: true });
});

test('SOLVÆR candidate cannot cross the render bridge with authoritative execution flags', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  assert.throws(() => buildSolvaerDecisionRenderBridge({ request: baseline.solvaerRequest, candidate: { ...baseline.proposal, experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId, authoritative: true }, provenanceRef: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId }, twinState: baseline.twinState, forecast: baseline.forecast, proposal: baseline.proposal, scene: baseline.scene, presentation: baseline.presentation }), /authoritative|validation/i);
});
