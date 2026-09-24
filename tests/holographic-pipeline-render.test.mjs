import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import {
  RENDERER_CONTRACT_VERSION,
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
    {
      id: 'grid-1',
      kind: 'grid_interconnect',
      powerKw: -15,
      importLimitKw: 80,
      exportLimitKw: 40,
    },
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

test('pipeline emits a validated renderer packet without changing simulation authority', () => {
  const result = runSyntheticMicrogrid(fixture);
  assert.equal(result.simulation.status, 'passed');
  assert.equal(result.presentation.status, 'ready-for-renderer');
  assert.equal(result.renderPacket.contractVersion, RENDERER_CONTRACT_VERSION);
  assert.equal(result.renderPacket.sceneId, result.scene.sceneId);
  assert.equal(result.renderPacket.target, 'holo-mat');
  assert.equal(result.renderPacket.deviceId, 'holo-mat-reference');
  assert.deepEqual(result.renderPacket.evidence, result.scene.evidence);
  assert.equal(result.renderPacket.evidence.powerFlows.length, 5);
  assert.equal(result.renderPacket.evidence.simulation.status, 'passed');
  assert.equal(result.renderPacket.safety.authoritative, false);
  assert.equal(result.renderPacket.safety.actuatesHardware, false);
  assert.equal(result.renderPacket.safety.advisoryOnly, true);
  assert.equal(validateHolographicRenderPacket(result.renderPacket), true);
});

test('pipeline preserves a valid render packet when presentation has no compatible device', () => {
  const result = runSyntheticMicrogrid(fixture, { presentationDevices: [] });
  assert.equal(result.simulation.status, 'passed');
  assert.equal(result.presentation.status, 'no-compatible-device');
  assert.equal(result.renderPacket.status, 'no-compatible-device');
  assert.equal(result.renderPacket.deviceId, null);
  assert.equal(result.renderPacket.target, null);
  assert.equal(validateHolographicRenderPacket(result.renderPacket), true);
});

test('pipeline render packet changes only with the requested presentation target', () => {
  const result = runSyntheticMicrogrid(fixture, {
    preferredPresentationTarget: 'volumetric-3d',
  });
  assert.equal(result.renderPacket.target, 'volumetric-3d');
  assert.equal(result.renderPacket.deviceId, 'volumetric-reference');
  assert.equal(result.simulation.backend, 'thergrid-classical-reference-v1');
  assert.equal(result.promotion.authoritative, false);
  assert.equal(validateHolographicRenderPacket(result.renderPacket), true);
});
