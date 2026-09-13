import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compileHolographicRenderPacket,
  validateHolographicRenderPacket,
  RENDERER_CONTRACT_VERSION,
} from '../src/holographic-renderer-contract.mjs';

const scene = {
  sceneVersion: 2,
  sceneId: 'scene-render-001',
  snapshotId: 'snapshot-001',
  coordinateSystem: 'thergrid-logical-grid-v1',
  layers: { topology: true, powerFlows: true, simulationEvidence: true },
  nodes: [{ id: 'node-a', position: { x: 1, y: 2, z: 3 } }],
  metrics: { balanceKw: 4 },
  provenanceRef: 'receipt-001',
};

const presentation = {
  schemaVersion: 1,
  sceneId: 'scene-render-001',
  target: 'holo-mat',
  deviceId: 'mat-a',
  status: 'ready-for-renderer',
};

test('uses renderer contract v2 and preserves the safety boundary', () => {
  const packet = compileHolographicRenderPacket({ scene, presentation });
  assert.equal(RENDERER_CONTRACT_VERSION, 2);
  assert.equal(packet.contractVersion, 2);
  assert.equal(packet.target, 'holo-mat');
  assert.equal(packet.deviceId, 'mat-a');
  assert.equal(packet.nodes[0].position.z, 3);
  assert.equal(packet.safety.authoritative, false);
  assert.equal(packet.safety.actuatesHardware, false);
  assert.equal(packet.safety.advisoryOnly, true);
  assert.equal(validateHolographicRenderPacket(packet), true);
});

test('binds renderer packets to experiment and receipt identity', () => {
  const packet = compileHolographicRenderPacket({
    scene,
    presentation,
    experimentId: 'experiment-001',
    receiptId: 'receipt-001',
  });
  assert.equal(packet.experimentId, 'experiment-001');
  assert.equal(packet.receiptId, 'receipt-001');
  assert.equal(validateHolographicRenderPacket(packet), true);
});

test('rejects malformed evidence identity at compilation', () => {
  assert.throws(
    () => compileHolographicRenderPacket({ scene, presentation, experimentId: '   ' }),
    /experimentId must be a non-empty string/,
  );
});

test('rejects a mismatched scene and presentation', () => {
  assert.throws(
    () => compileHolographicRenderPacket({
      scene,
      presentation: { ...presentation, sceneId: 'other-scene' },
    }),
    /sceneId must match/,
  );
});

test('detects tampering after compilation', () => {
  const packet = compileHolographicRenderPacket({ scene, presentation });
  assert.equal(validateHolographicRenderPacket({ ...packet, target: 'projector' }), false);
  assert.equal(validateHolographicRenderPacket({ ...packet, experimentId: 'tampered' }), false);
});

test('requires a device for a renderer-ready plan', () => {
  assert.throws(
    () => compileHolographicRenderPacket({
      scene,
      presentation: { ...presentation, deviceId: null },
    }),
    /requires a deviceId/,
  );
});

test('fails closed on unsupported render targets', () => {
  assert.throws(
    () => compileHolographicRenderPacket({
      scene,
      presentation: { ...presentation, target: 'unsupported-surface' },
    }),
    /unsupported render target/,
  );
});
