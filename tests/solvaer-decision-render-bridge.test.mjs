import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { validateSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { buildSolvaerDecisionRenderBridge } from '../src/solvaer-decision-render-bridge.mjs';
import { validateHolographicRenderPacket } from '../src/holographic-renderer-contract.mjs';

const snapshot = {
  snapshotId: 'snapshot-bridge-001',
  observedAt: '2026-09-13T12:00:00Z',
  nodes: [
    { id: 'n1', demandKw: 42, generationKw: 48 },
    { id: 'n2', demandKw: 36, generationKw: 30 },
  ],
};

test('SOLVÆR decision bridge preserves experiment evidence through rendering', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const candidate = {
    experimentId: baseline.experimentId,
    snapshotId: snapshot.snapshotId,
    proposal: baseline.proposal,
    forecast: baseline.forecast,
    rationale: 'explore a simulation-bound candidate',
  };
  const bridge = buildSolvaerDecisionRenderBridge({
    request: baseline.solvaerRequest,
    candidate,
    provenanceRef: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId },
    twinState: baseline.twinState,
    forecast: baseline.forecast,
    proposal: baseline.proposal,
    scene: baseline.scene,
    presentation: baseline.presentation,
  });

  assert.equal(bridge.experimentId, baseline.experimentId);
  assert.equal(bridge.decision.simulation.status, 'passed');
  assert.equal(bridge.decision.promotionEligible, false);
  assert.equal(bridge.collaborationEvidence.experimentId, baseline.experimentId);
  assert.equal(validateSolvaerCollaborationEvidence(bridge.collaborationEvidence), true);
  assert.equal(bridge.renderPacket.experimentId, baseline.experimentId);
  assert.equal(bridge.renderPacket.receiptId, bridge.decision.decisionReceipt.receiptId);
  assert.equal(validateHolographicRenderPacket(bridge.renderPacket), true);
  assert.deepEqual(bridge.safety, { authoritative: false, actuatesHardware: false, advisoryOnly: true });
});

test('SOLVÆR candidate cannot cross the render bridge with authoritative execution flags', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  assert.throws(() => buildSolvaerDecisionRenderBridge({
    request: baseline.solvaerRequest,
    candidate: { ...baseline.proposal, experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId, authoritative: true },
    provenanceRef: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId },
    twinState: baseline.twinState,
    forecast: baseline.forecast,
    proposal: baseline.proposal,
    scene: baseline.scene,
    presentation: baseline.presentation,
  }), /authoritative|validation/i);
});
