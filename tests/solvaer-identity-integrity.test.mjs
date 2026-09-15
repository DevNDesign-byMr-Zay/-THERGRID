import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { buildSolvaerDecisionRenderBridge } from '../src/solvaer-decision-render-bridge.mjs';
import { validateSolvaerCollaborationResult } from '../src/solvaer-collaboration-validator.mjs';
import { SOLVAER_PRODUCER_IDENTITY } from '../src/solvaer-optimization-contract.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'integrity-adversarial-v1',
  observedAt: '2026-09-14T00:00:00.000Z',
  assets: [
    { id: 'solar-1', kind: 'solar', powerKw: 40, capacityKw: 50 },
    { id: 'load-1', kind: 'load', powerKw: 35, flexible: true },
    { id: 'grid-1', kind: 'grid_interconnect', powerKw: -5, importLimitKw: 80, exportLimitKw: 40 },
  ],
  topology: { nodes: ['node-a'], connections: [
    { assetId: 'solar-1', nodeId: 'node-a' },
    { assetId: 'load-1', nodeId: 'node-a' },
    { assetId: 'grid-1', nodeId: 'node-a' },
  ] },
};

function baselineArtifacts() {
  const baseline = runSyntheticMicrogrid(snapshot);
  const candidate = {
    experimentId: baseline.experimentId,
    snapshotId: snapshot.snapshotId,
    producerIdentity: SOLVAER_PRODUCER_IDENTITY,
    proposal: baseline.proposal,
  };
  const provenanceRef = {
    experimentId: baseline.experimentId,
    snapshotId: snapshot.snapshotId,
    producerIdentity: SOLVAER_PRODUCER_IDENTITY,
  };
  return { baseline, candidate, provenanceRef };
}

test('accepts the full SOLVÆR decision-to-render chain with bound identity', () => {
  const { baseline, candidate, provenanceRef } = baselineArtifacts();
  assert.equal(validateSolvaerCollaborationResult({ request: baseline.solvaerRequest, candidate, provenanceRef }), true);
  const bridge = buildSolvaerDecisionRenderBridge({
    request: baseline.solvaerRequest,
    candidate,
    provenanceRef,
    twinState: baseline.twinState,
    forecast: baseline.forecast,
    proposal: baseline.proposal,
    scene: baseline.scene,
    presentation: baseline.presentation,
  });
  assert.equal(bridge.decision.candidate.producerIdentity.family, 'SOLVÆR');
  assert.equal(bridge.operatorAttention.evidenceRef ?? bridge.operatorAttention.items[0].evidenceRef, bridge.collaborationEvidence.evidenceFingerprint);
  assert.equal(bridge.renderPacket.experimentId, baseline.experimentId);
  assert.equal(bridge.renderPacket.receiptId, bridge.decision.decisionReceipt.receiptId);
});

test('rejects a candidate identity swap before evidence is admitted', () => {
  const { baseline, candidate, provenanceRef } = baselineArtifacts();
  const swapped = { ...candidate, producerIdentity: { ...SOLVAER_PRODUCER_IDENTITY, family: 'VÆLON' } };
  assert.equal(validateSolvaerCollaborationResult({ request: baseline.solvaerRequest, candidate: swapped, provenanceRef }), false);
});

test('rejects a provenance identity swap even when the candidate is unchanged', () => {
  const { baseline, candidate, provenanceRef } = baselineArtifacts();
  const swappedProvenance = { ...provenanceRef, producerIdentity: { ...SOLVAER_PRODUCER_IDENTITY, family: 'ROARY' } };
  assert.equal(validateSolvaerCollaborationResult({ request: baseline.solvaerRequest, candidate, provenanceRef: swappedProvenance }), false);
});

test('rejects a request identity swap rather than silently treating it as SOLVÆR', () => {
  const { baseline, candidate, provenanceRef } = baselineArtifacts();
  const swappedRequest = { ...baseline.solvaerRequest, producerIdentity: { ...SOLVAER_PRODUCER_IDENTITY, family: 'AUREN' } };
  assert.equal(validateSolvaerCollaborationResult({ request: swappedRequest, candidate, provenanceRef }), false);
});
