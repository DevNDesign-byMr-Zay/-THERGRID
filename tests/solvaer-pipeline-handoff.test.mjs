import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';

const fixture = {
  schemaVersion: 1,
  snapshotId: 'snapshot-solvaer-001',
  observedAt: '2026-09-13T18:00:00Z',
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

describe('SOLVÆR pipeline handoff', () => {
  it('emits an advisory optimization request anchored to the experiment and twin', () => {
    const result = runSyntheticMicrogrid(fixture);

    assert.equal(result.solvaerRequest.experimentId, result.experimentId);
    assert.equal(result.solvaerRequest.snapshotId, result.twinState.snapshotId);
    assert.equal(
      result.solvaerRequest.twinStateRef,
      `twin-state:${result.twinState.snapshotId}`,
    );
    assert.equal(result.solvaerRequest.capability, 'optimization.explore');
    assert.deepEqual(result.solvaerRequest.safety, {
      advisoryOnly: true,
      authoritative: false,
      actuatesHardware: false,
    });
  });
});
