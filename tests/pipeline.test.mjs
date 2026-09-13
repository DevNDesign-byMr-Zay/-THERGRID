import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { createModelRoute, buildModelEvidence } from '../src/model-routing.mjs';

const fixture = {
  schemaVersion: 1,
  snapshotId: 'synthetic-v1',
  observedAt: '2026-09-13T00:00:00.000Z',
  assets: [
    { id: 'solar-1', kind: 'solar', powerKw: 40, capacityKw: 50 },
    { id: 'wind-1', kind: 'wind', powerKw: 20, capacityKw: 30 },
    { id: 'battery-1', kind: 'battery', powerKw: 0, capacityKw: 25, capacityKwh: 100, stateOfChargeKwh: 60 },
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

test('runs the complete deterministic vertical slice', () => {
  const first = runSyntheticMicrogrid(fixture);
  const second = runSyntheticMicrogrid(fixture);
  assert.deepEqual(first, second);
  assert.equal(first.simulation.backend, 'thergrid-classical-reference-v1');
  assert.equal(first.simulation.safety.physicalActuation, false);
  assert.match(first.receipt.receiptId, /^[a-f0-9]{64}$/);
  assert.equal(first.scene.sceneVersion, 1);
});

test('records VÆLON capability and explicit fallback identity', () => {
  const route = createModelRoute({ model: 'VÆLON', version: 'phase-2-contract' });
  const evidence = buildModelEvidence({ route, capability: 'optimization.explore', fallbackUsed: true });
  assert.equal(evidence.model, 'VÆLON');
  assert.equal(evidence.fallbackUsed, true);
  assert.equal(evidence.fallbackIdentity, 'classical-reference-v1');
});

test('rejects unsupported model capabilities', () => {
  const route = createModelRoute();
  assert.throws(() => route.resolve('actuate.grid'), /unsupported capability/);
});
