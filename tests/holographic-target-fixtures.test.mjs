import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSpatialScene } from '../src/spatial-scene.mjs';
import { planHolographicPresentation } from '../src/holographic-device-registry.mjs';
import {
  compileHolographicRenderPacket,
  validateHolographicRenderPacket,
} from '../src/holographic-renderer-contract.mjs';

const twinState = {
  snapshotId: 'snapshot-fixture-001',
  observedAt: '2026-09-13T18:00:00Z',
  totals: {
    generationKw: 128,
    loadKw: 104,
    balanceKw: 24,
    renewableSharePercent: 72,
  },
};

const devices = [
  {
    id: 'fixture-holomat',
    type: 'holo-mat',
    capabilities: ['topology', 'power-flows', 'forecast-delta'],
    online: true,
  },
  {
    id: 'fixture-projector',
    type: 'projector',
    capabilities: ['topology', 'alerts'],
    online: true,
  },
  {
    id: 'fixture-volumetric',
    type: 'volumetric-3d',
    capabilities: ['topology', 'power-flows', 'forecast-delta'],
    online: true,
  },
];

function expectedDeviceId(target) {
  if (target === 'holo-mat') return 'fixture-holomat';
  if (target === 'volumetric-3d') return 'fixture-volumetric';
  return 'fixture-projector';
}

describe('holographic target fixtures', () => {
  for (const target of ['holo-mat', 'projector', 'volumetric-3d']) {
    it(`compiles a deterministic ${target} packet`, () => {
      const scene = buildSpatialScene({
        twinState,
        provenance: { experimentId: 'experiment-fixture-001' },
      });
      const presentation = planHolographicPresentation({
        scene,
        devices,
        preferredTarget: target,
      });
      const packet = compileHolographicRenderPacket({ scene, presentation });

      assert.equal(packet.target, target);
      assert.equal(packet.deviceId, expectedDeviceId(target));
      assert.equal(packet.snapshotId, twinState.snapshotId);
      assert.equal(validateHolographicRenderPacket(packet), true);
      assert.deepEqual(packet.safety, {
        authoritative: false,
        actuatesHardware: false,
        advisoryOnly: true,
      });
    });
  }

  it('preserves graceful degradation when every fixture device is offline', () => {
    const scene = buildSpatialScene({
      twinState,
      provenance: { experimentId: 'experiment-fixture-001' },
    });
    const offline = devices.map((device) => ({ ...device, online: false }));
    const presentation = planHolographicPresentation({
      scene,
      devices: offline,
    });
    const packet = compileHolographicRenderPacket({ scene, presentation });

    assert.equal(presentation.status, 'no-compatible-device');
    assert.equal(packet.target, null);
    assert.equal(packet.deviceId, null);
    assert.equal(validateHolographicRenderPacket(packet), true);
  });
});
