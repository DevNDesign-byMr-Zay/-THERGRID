import { describe, expect, it } from 'vitest';
import { buildSpatialScene } from '../src/spatial-scene.mjs';
import { planHolographicPresentation } from '../src/holographic-device-registry.mjs';
import { compileHolographicRenderPacket, validateHolographicRenderPacket } from '../src/holographic-renderer-contract.mjs';

const twinState = {
  snapshotId: 'snapshot-fixture-001',
  observedAt: '2026-09-13T18:00:00Z',
  totals: { generationKw: 128, loadKw: 104, balanceKw: 24, renewableSharePercent: 72 },
};

const devices = [
  { id: 'fixture-holomat', type: 'holo-mat', capabilities: ['topology', 'power-flows', 'forecast-delta'], online: true },
  { id: 'fixture-projector', type: 'projector', capabilities: ['topology', 'alerts'], online: true },
  { id: 'fixture-volumetric', type: 'volumetric-3d', capabilities: ['topology', 'power-flows', 'forecast-delta'], online: true },
];

describe('holographic target fixtures', () => {
  for (const target of ['holo-mat', 'projector', 'volumetric-3d']) {
    it(`compiles a deterministic ${target} packet`, () => {
      const scene = buildSpatialScene({ twinState, provenance: { experimentId: 'experiment-fixture-001' } });
      const presentation = planHolographicPresentation({ scene, devices, preferredTarget: target });
      const packet = compileHolographicRenderPacket({ scene, presentation });

      expect(packet.target).toBe(target);
      expect(packet.deviceId).toBe(`fixture-${target === 'holo-mat' ? 'holomat' : target === 'volumetric-3d' ? 'volumetric' : 'projector'}`);
      expect(packet.snapshotId).toBe(twinState.snapshotId);
      expect(validateHolographicRenderPacket(packet)).toBe(true);
      expect(packet.safety).toEqual({ authoritative: false, actuatesHardware: false, advisoryOnly: true });
    });
  }

  it('preserves graceful degradation when every fixture device is offline', () => {
    const scene = buildSpatialScene({ twinState, provenance: { experimentId: 'experiment-fixture-001' } });
    const offline = devices.map((device) => ({ ...device, online: false }));
    const presentation = planHolographicPresentation({ scene, devices: offline });
    const packet = compileHolographicRenderPacket({ scene, presentation });

    expect(presentation.status).toBe('no-compatible-device');
    expect(packet.target).toBeNull();
    expect(packet.deviceId).toBeNull();
    expect(validateHolographicRenderPacket(packet)).toBe(true);
  });
});
