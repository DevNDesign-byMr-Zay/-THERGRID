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
    () =>
      compileHolographicRenderPacket({
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
    () =>
      compileHolographicRenderPacket({
        scene,
        presentation: { ...presentation, deviceId: null },
      }),
    /requires a deviceId/,
  );
});

test('fails closed on unsupported render targets', () => {
  assert.throws(
    () =>
      compileHolographicRenderPacket({
        scene,
        presentation: { ...presentation, target: 'unsupported-surface' },
      }),
    /unsupported render target/,
  );
});

test('defensively captures nested scene evidence before checksumming', () => {
  const mutableScene = JSON.parse(JSON.stringify(scene));
  const packet = compileHolographicRenderPacket({ scene: mutableScene, presentation });

  mutableScene.nodes[0].position.z = 999;
  mutableScene.layers.topology = false;

  assert.equal(packet.nodes[0].position.z, 3);
  assert.equal(packet.layers.topology, true);
  assert.equal(Object.isFrozen(packet), true);
  assert.equal(Object.isFrozen(packet.nodes), true);
  assert.equal(Object.isFrozen(packet.nodes[0].position), true);
  assert.equal(validateHolographicRenderPacket(packet), true);
});

test('compilation rejects accessors without executing getters', () => {
  let inputGetterReads = 0;
  let sceneGetterReads = 0;
  const deceptiveInput = { presentation };
  Object.defineProperty(deceptiveInput, 'scene', {
    enumerable: true,
    get() {
      inputGetterReads += 1;
      return scene;
    },
  });

  assert.throws(() => compileHolographicRenderPacket(deceptiveInput), /must not use accessors/);
  assert.equal(inputGetterReads, 0);

  const deceptiveScene = { ...scene };
  Object.defineProperty(deceptiveScene, 'nodes', {
    enumerable: true,
    get() {
      sceneGetterReads += 1;
      return scene.nodes;
    },
  });
  assert.throws(
    () => compileHolographicRenderPacket({ scene: deceptiveScene, presentation }),
    /must not use accessors/,
  );
  assert.equal(sceneGetterReads, 0);
});

test('validation rejects packet and safety accessors without executing getters', () => {
  const packet = compileHolographicRenderPacket({ scene, presentation });
  let packetGetterReads = 0;
  let safetyGetterReads = 0;

  const deceptivePacket = { ...packet };
  Object.defineProperty(deceptivePacket, 'checksum', {
    enumerable: true,
    get() {
      packetGetterReads += 1;
      return packet.checksum;
    },
  });
  assert.equal(validateHolographicRenderPacket(deceptivePacket), false);
  assert.equal(packetGetterReads, 0);

  const safety = { ...packet.safety };
  Object.defineProperty(safety, 'authoritative', {
    enumerable: true,
    get() {
      safetyGetterReads += 1;
      return false;
    },
  });
  assert.equal(validateHolographicRenderPacket({ ...packet, safety }), false);
  assert.equal(safetyGetterReads, 0);
});

test('rejects extra fields, symbols, decorated arrays, and alternate prototypes', () => {
  const packet = compileHolographicRenderPacket({ scene, presentation });

  assert.equal(validateHolographicRenderPacket({ ...packet, authority: true }), false);

  const symbolic = { ...packet };
  symbolic[Symbol('authority')] = true;
  assert.equal(validateHolographicRenderPacket(symbolic), false);

  const nodes = packet.nodes.map((node) => JSON.parse(JSON.stringify(node)));
  nodes.shadowAuthority = true;
  assert.equal(validateHolographicRenderPacket({ ...packet, nodes }), false);

  assert.equal(validateHolographicRenderPacket(Object.create(packet)), false);
});
