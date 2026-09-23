import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { buildSolvaerDecisionRenderBridge } from '../src/solvaer-decision-render-bridge.mjs';
import { validateSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { validateHolographicRenderPacket } from '../src/holographic-renderer-contract.mjs';

function snapshot(snapshotId) {
  return {
    schemaVersion: 1,
    snapshotId,
    observedAt: '2026-01-01T00:00:00.000Z',
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

function bridgeFor(source, mutateScene = (scene) => scene) {
  const baseline = runSyntheticMicrogrid(source);
  return {
    baseline,
    bridge: buildSolvaerDecisionRenderBridge({
      request: baseline.solvaerRequest,
      candidate: {
        model: 'SOLVÆR-reference',
        solver: 'exploration-v1',
        experimentId: baseline.experimentId,
        snapshotId: source.snapshotId,
        proposal: baseline.proposal,
        forecast: baseline.forecast,
        authoritative: false,
        actuatesHardware: false,
        physicalActuation: false,
      },
      provenanceRef: { experimentId: baseline.experimentId, snapshotId: source.snapshotId },
      twinState: baseline.twinState,
      forecast: baseline.forecast,
      proposal: baseline.proposal,
      scene: mutateScene(baseline.scene),
      presentation: baseline.presentation,
    }),
  };
}

test('SOLVÆR decision-to-render bridge preserves experiment identity and safety', () => {
  const source = snapshot('snapshot-bridge-001');
  const { baseline, bridge } = bridgeFor(source);

  assert.equal(bridge.requestId, baseline.solvaerRequest.requestId);
  assert.equal(bridge.experimentId, baseline.experimentId);
  assert.equal(bridge.decision.simulation.status, 'passed');
  assert.equal(bridge.promotionEligible, false);
  assert.equal(bridge.handoff, 'simulation-evidence-required');
  assert.equal(validateSolvaerCollaborationEvidence(bridge.collaborationEvidence), true);
  assert.equal(validateHolographicRenderPacket(bridge.renderPacket), true);
  assert.equal(bridge.renderPacket.experimentId, baseline.experimentId);
  assert.equal(bridge.renderPacket.receiptId, bridge.decision.decisionReceipt.receiptId);
  assert.equal(bridge.safety.actuatesHardware, false);
});

test('SOLVÆR bridge rejects authoritative candidates before rendering', () => {
  const source = snapshot('snapshot-bridge-002');
  const baseline = runSyntheticMicrogrid(source);
  const unsafeCandidate = {
    model: 'SOLVÆR-reference',
    solver: 'exploration-v1',
    experimentId: baseline.experimentId,
    snapshotId: source.snapshotId,
    proposal: baseline.proposal,
    authoritative: true,
    actuatesHardware: false,
    physicalActuation: false,
  };

  assert.throws(
    () =>
      buildSolvaerDecisionRenderBridge({
        request: baseline.solvaerRequest,
        candidate: unsafeCandidate,
        provenanceRef: { experimentId: baseline.experimentId, snapshotId: source.snapshotId },
        twinState: baseline.twinState,
        forecast: baseline.forecast,
        proposal: baseline.proposal,
        scene: baseline.scene,
        presentation: baseline.presentation,
      }),
    /authority|physical actuation/i,
  );
});

test('SOLVÆR bridge rejects scene provenance drift before rendering', () => {
  const source = snapshot('snapshot-bridge-003');
  assert.throws(
    () =>
      bridgeFor(source, (scene) => ({
        ...scene,
        provenanceRef: {
          experimentId: scene.provenanceRef.experimentId,
          snapshotId: 'different-snapshot',
        },
      })),
    /provenanceRef must match SOLVÆR provenanceRef/i,
  );
});

test('SOLVÆR bridge rejects accessor-backed scene provenance without executing it', () => {
  const source = snapshot('snapshot-bridge-004');
  const baseline = runSyntheticMicrogrid(source);
  let getterExecuted = false;
  const scene = { ...baseline.scene };
  Object.defineProperty(scene, 'provenanceRef', {
    enumerable: true,
    configurable: true,
    get() {
      getterExecuted = true;
      return baseline.scene.provenanceRef;
    },
  });

  assert.throws(
    () =>
      buildSolvaerDecisionRenderBridge({
        request: baseline.solvaerRequest,
        candidate: {
          model: 'SOLVÆR-reference',
          solver: 'exploration-v1',
          experimentId: baseline.experimentId,
          snapshotId: source.snapshotId,
          proposal: baseline.proposal,
          forecast: baseline.forecast,
          authoritative: false,
          actuatesHardware: false,
          physicalActuation: false,
        },
        provenanceRef: { experimentId: baseline.experimentId, snapshotId: source.snapshotId },
        twinState: baseline.twinState,
        forecast: baseline.forecast,
        proposal: baseline.proposal,
        scene,
        presentation: baseline.presentation,
      }),
    /scene\.provenanceRef must not use accessors/i,
  );
  assert.equal(getterExecuted, false);
});
