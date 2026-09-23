import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { evaluateSolvaerDecisionHandoff } from '../src/solvaer-decision-handoff.mjs';
import {
  compileHolographicRenderPacket,
  validateHolographicRenderPacket,
} from '../src/holographic-renderer-contract.mjs';

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

test('keeps SOLVÆR decision evidence and holographic rendering on the same experiment chain', () => {
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

  const packet = compileHolographicRenderPacket({
    scene: baseline.scene,
    presentation: baseline.presentation,
    experimentId: baseline.experimentId,
    receiptId: handoff.decisionReceipt.receiptId,
  });

  assert.equal(handoff.simulation.status, 'passed');
  assert.equal(handoff.promotionEligible, false);
  assert.equal(handoff.safety.authoritative, false);
  assert.equal(packet.experimentId, baseline.experimentId);
  assert.equal(packet.receiptId, handoff.decisionReceipt.receiptId);
  assert.equal(packet.safety.actuatesHardware, false);
  assert.equal(validateHolographicRenderPacket(packet), true);
});

test('rejects an evidence chain when the render receipt is swapped', () => {
  const baseline = runSyntheticMicrogrid(fixture);
  const packet = compileHolographicRenderPacket({
    scene: baseline.scene,
    presentation: baseline.presentation,
    experimentId: baseline.experimentId,
    receiptId: baseline.receipt.receiptId,
  });
  const tampered = { ...packet, receiptId: 'f'.repeat(64) };
  assert.equal(validateHolographicRenderPacket(tampered), false);
});
