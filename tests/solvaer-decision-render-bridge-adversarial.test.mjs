import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { buildSolvaerDecisionRenderBridge } from '../src/solvaer-decision-render-bridge.mjs';
import { validateSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { validateHolographicRenderPacket } from '../src/holographic-renderer-contract.mjs';

test('SOLVÆR decision-to-render bridge preserves experiment identity and safety', () => {
  const snapshot = {
    schemaVersion: 1,
    snapshotId: 'snapshot-bridge-001',
    observedAt: '2026-01-01T00:00:00.000Z',
    assets: [
      { id: 'load-1', kind: 'load', powerKw: 18 },
      { id: 'solar-1', kind: 'solar', powerKw: 22, capacityKw: 30 },
    ],
  };
  const baseline = runSyntheticMicrogrid(snapshot);
  const candidate = {
    model: 'SOLVÆR-reference',
    solver: 'exploration-v1',
    experimentId: baseline.experimentId,
    snapshotId: snapshot.snapshotId,
    proposal: baseline.proposal,
    forecast: baseline.forecast,
    authoritative: false,
    actuatesHardware: false,
    physicalActuation: false,
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
  assert.equal(bridge.promotionEligible, false);
  assert.equal(bridge.handoff, 'simulation-evidence-required');
  assert.equal(validateSolvaerCollaborationEvidence(bridge.collaborationEvidence), true);
  assert.equal(validateHolographicRenderPacket(bridge.renderPacket), true);
  assert.equal(bridge.renderPacket.experimentId, baseline.experimentId);
  assert.equal(bridge.renderPacket.receiptId, bridge.decision.decisionReceipt.receiptId);
  assert.equal(bridge.safety.physicalActuation, false);
});

test('SOLVÆR bridge rejects authoritative candidates before rendering', () => {
  const snapshot = {
    schemaVersion: 1,
    snapshotId: 'snapshot-bridge-002',
    observedAt: '2026-01-01T00:00:00.000Z',
    assets: [{ id: 'load-1', kind: 'load', powerKw: 20 }],
  };
  const baseline = runSyntheticMicrogrid(snapshot);
  const unsafeCandidate = {
    model: 'SOLVÆR-reference',
    solver: 'exploration-v1',
    experimentId: baseline.experimentId,
    snapshotId: snapshot.snapshotId,
    proposal: baseline.proposal,
    authoritative: true,
    actuatesHardware: false,
    physicalActuation: false,
  };

  assert.throws(() => buildSolvaerDecisionRenderBridge({
    request: baseline.solvaerRequest,
    candidate: unsafeCandidate,
    provenanceRef: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId },
    twinState: baseline.twinState,
    forecast: baseline.forecast,
    proposal: baseline.proposal,
    scene: baseline.scene,
    presentation: baseline.presentation,
  }));
});
