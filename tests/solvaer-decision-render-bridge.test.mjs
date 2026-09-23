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
  observedAt: '2026-09-13T12:00:00.000Z',
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

function bridgeInput(baseline) {
  return {
    request: baseline.solvaerRequest,
    candidate: {
      experimentId: baseline.experimentId,
      snapshotId: snapshot.snapshotId,
      proposal: baseline.proposal,
      forecast: baseline.forecast,
      rationale: 'explore a simulation-bound candidate',
    },
    provenanceRef: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId },
    twinState: baseline.twinState,
    forecast: baseline.forecast,
    proposal: baseline.proposal,
    scene: baseline.scene,
    presentation: baseline.presentation,
  };
}

test('SOLVÆR decision bridge preserves experiment evidence through rendering and operator attention', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const bridge = buildSolvaerDecisionRenderBridge(bridgeInput(baseline));

  assert.equal(bridge.requestId, baseline.solvaerRequest.requestId);
  assert.equal(bridge.experimentId, baseline.experimentId);
  assert.equal(bridge.decision.simulation.status, 'passed');
  assert.equal(bridge.decision.promotionEligible, false);
  assert.equal(bridge.collaborationEvidence.requestId, baseline.solvaerRequest.requestId);
  assert.equal(bridge.collaborationEvidence.experimentId, baseline.experimentId);
  assert.equal(validateSolvaerCollaborationEvidence(bridge.collaborationEvidence), true);
  assert.equal(bridge.operatorAttention.requestId, baseline.solvaerRequest.requestId);
  assert.equal(bridge.operatorAttention.experimentId, baseline.experimentId);
  assert.equal(bridge.operatorAttention.snapshotId, snapshot.snapshotId);
  assert.equal(validateSolvaerOperatorAttention(bridge.operatorAttention), true);
  assert.equal(bridge.operatorAttention.items.length, 2);
  assert.equal(
    bridge.operatorAttention.items[0].evidenceRef,
    bridge.collaborationEvidence.evidenceFingerprint,
  );
  assert.equal(bridge.renderPacket.experimentId, baseline.experimentId);
  assert.equal(bridge.renderPacket.receiptId, bridge.decision.decisionReceipt.receiptId);
  assert.equal(bridge.renderPacket.provenanceRef.receiptId, bridge.renderPacket.receiptId);
  assert.equal(
    bridge.renderPacket.operatorAttentionFingerprint,
    bridge.operatorAttention.attentionFingerprint,
  );
  assert.equal(validateHolographicRenderPacket(bridge.renderPacket), true);
  assert.deepEqual(bridge.safety, {
    authoritative: false,
    physicalActuation: false,
    actuatesHardware: false,
    advisoryOnly: true,
  });
});

test('SOLVÆR bridge rejects a scene carrying a stale decision receipt identity', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const input = bridgeInput(baseline);
  input.scene = {
    ...baseline.scene,
    provenanceRef: {
      ...baseline.scene.provenanceRef,
      receiptId: 'receipt-stale-or-substituted',
    },
  };

  assert.throws(
    () => buildSolvaerDecisionRenderBridge(input),
    /scene receiptId must match SOLVÆR decision receiptId/,
  );
});

test('SOLVÆR candidate cannot cross the render bridge with authoritative execution flags', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const input = bridgeInput(baseline);
  input.candidate = { ...input.candidate, authoritative: true };

  assert.throws(
    () => buildSolvaerDecisionRenderBridge(input),
    /authority|physical actuation|validation/i,
  );
});

test('SOLVÆR bridge rejects authority accessors without evaluating them', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  let getterReads = 0;
  const input = bridgeInput(baseline);
  Object.defineProperty(input.candidate, 'authoritative', {
    enumerable: true,
    get() {
      getterReads += 1;
      return false;
    },
  });

  assert.throws(() => buildSolvaerDecisionRenderBridge(input), /must not use accessors/);
  assert.equal(getterReads, 0);
});

test('SOLVÆR bridge rejects top-level accessors before evaluating them', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const input = bridgeInput(baseline);
  let getterReads = 0;
  Object.defineProperty(input, 'request', {
    enumerable: true,
    configurable: true,
    get() {
      getterReads += 1;
      return baseline.solvaerRequest;
    },
  });

  assert.throws(() => buildSolvaerDecisionRenderBridge(input), /render bridge input.request must not use accessors/);
  assert.equal(getterReads, 0);
});

test('SOLVÆR bridge rejects inherited, symbol-bearing, and unsupported top-level inputs', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const inherited = Object.assign(Object.create({ inherited: true }), bridgeInput(baseline));
  assert.throws(() => buildSolvaerDecisionRenderBridge(inherited), /render bridge input must be a plain object/);

  const symbolBearing = bridgeInput(baseline);
  symbolBearing[Symbol('hidden')] = 'not-evidence';
  assert.throws(() => buildSolvaerDecisionRenderBridge(symbolBearing), /symbol properties/);

  const widened = { ...bridgeInput(baseline), executeNow: true };
  assert.throws(() => buildSolvaerDecisionRenderBridge(widened), /unsupported field: executeNow/);
});

test('SOLVÆR bridge rejects deceptive provenance descriptors without evaluating them', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const input = bridgeInput(baseline);
  let getterReads = 0;
  Object.defineProperty(input.provenanceRef, 'experimentId', {
    enumerable: true,
    configurable: true,
    get() {
      getterReads += 1;
      return baseline.experimentId;
    },
  });

  assert.throws(() => buildSolvaerDecisionRenderBridge(input), /provenanceRef.experimentId must not use accessors/);
  assert.equal(getterReads, 0);
});

test('SOLVÆR bridge rejects symbol-bearing provenance before render handoff', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const input = bridgeInput(baseline);
  input.provenanceRef[Symbol('hidden')] = baseline.experimentId;

  assert.throws(() => buildSolvaerDecisionRenderBridge(input), /provenanceRef must not contain symbol properties/);
});
