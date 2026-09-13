import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createHolographicDeviceDescriptor,
  planHolographicPresentation,
  selectCompatibleDevice,
} from '../src/holographic-device-registry.mjs';

const scene = {
  sceneVersion: 2,
  sceneId: 'scene-microgrid-demo',
  rendererContract: {
    supportedTargets: ['holo-mat', 'projector', 'web-dashboard'],
  },
};

const devices = [
  { id: 'mat-a', type: 'holo-mat', capabilities: ['depth', 'spatial-mapping'], online: true },
  { id: 'projector-a', type: 'projector', capabilities: ['keystone'], online: false },
  { id: 'dashboard-a', type: 'web-dashboard', capabilities: ['2d'], online: true },
];

test('normalizes a holographic device descriptor', () => {
  const descriptor = createHolographicDeviceDescriptor(devices[0]);
  assert.deepEqual(descriptor.capabilities, ['depth', 'spatial-mapping']);
  assert.equal(descriptor.authoritative, false);
});

test('selects only online devices of the requested target type', () => {
  assert.equal(selectCompatibleDevice(devices, 'holo-mat').id, 'mat-a');
  assert.equal(selectCompatibleDevice(devices, 'projector'), null);
});

test('builds a renderer-ready plan without actuating hardware', () => {
  const plan = planHolographicPresentation({ scene, devices });
  assert.equal(plan.target, 'holo-mat');
  assert.equal(plan.deviceId, 'mat-a');
  assert.equal(plan.status, 'ready-for-renderer');
  assert.equal(plan.authoritative, false);
  assert.equal(plan.actuatesHardware, false);
});

test('fails closed for an unsupported preferred target', () => {
  assert.throws(
    () => planHolographicPresentation({ scene, devices, preferredTarget: 'volumetric-3d' }),
    /not supported by the scene/,
  );
});

test('reports no compatible device without inventing a hardware action', () => {
  const plan = planHolographicPresentation({
    scene,
    devices,
    preferredTarget: 'projector',
  });
  assert.equal(plan.status, 'no-compatible-device');
  assert.equal(plan.deviceId, null);
  assert.equal(plan.actuatesHardware, false);
});
