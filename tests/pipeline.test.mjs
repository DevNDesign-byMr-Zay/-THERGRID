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

test('runs the complete deterministic vertical slice with evidence gates', () => {
  const first = runSyntheticMicrogrid(fixture);
  const second = runSyntheticMicrogrid(fixture);
  assert.deepEqual(first, second);
  assert.equal(first.simulation.backend, 'thergrid-classical-reference-v1');
  assert.equal(first.simulation.status, 'passed');
  assert.equal(first.simulation.safety.physicalActuation, false);
  assert.match(first.receipt.receiptId, /^[a-f0-9]{64}$/);
  assert.equal(first.scene.sceneVersion, 2);
  assert.deepEqual(first.scene.nodes, [
    {
      id: 'node-a',
      assetIds: ['solar-1', 'wind-1', 'battery-1', 'load-1', 'grid-1'],
    },
  ]);
  assert.equal(first.scene.rendererContract.mode, 'renderer-neutral');
  assert.equal(first.scene.evidence.powerFlows.length, 5);
  assert.deepEqual(first.scene.evidence.forecastDelta, {
    method: 'persistence-v1',
    forecastFor: first.forecast.forecastFor,
    generationKw: 60,
    loadKw: 45,
    generationDeltaKw: 0,
    loadDeltaKw: 0,
  });
  assert.deepEqual(first.scene.evidence.simulation, {
    backend: 'thergrid-classical-reference-v1',
    status: 'passed',
    durationMinutes: 15,
    runtimeMs: 0,
    residualBalanceKw: 0,
    gridAdjustmentKw: 0,
    advisoryOnly: true,
    physicalActuation: false,
  });
  assert.equal(first.presentation.status, 'ready-for-renderer');
  assert.equal(first.presentation.target, 'holo-mat');
  assert.equal(first.presentation.deviceId, 'holo-mat-reference');
  assert.equal(first.presentation.authoritative, false);
  assert.equal(first.presentation.actuatesHardware, false);
  assert.equal(first.provenance.contractVersion, 2);
  assert.deepEqual(
    first.provenance.nodes.map((node) => node.type),
    [
      'telemetry',
      'twin-state',
      'forecast',
      'operating-proposal',
      'simulation',
      'decision-receipt',
      'spatial-scene',
      'render-packet',
    ],
  );
  assert.equal(first.promotion.status, 'eligible');
  assert.equal(first.promotion.authoritative, false);
});

test('selects an explicit presentation target without changing the authoritative pipeline', () => {
  const result = runSyntheticMicrogrid(fixture, {
    preferredPresentationTarget: 'volumetric-3d',
  });
  assert.equal(result.presentation.target, 'volumetric-3d');
  assert.equal(result.presentation.deviceId, 'volumetric-reference');
  assert.equal(result.presentation.status, 'ready-for-renderer');
  assert.equal(result.receipt.receiptId.length, 64);
  assert.equal(result.presentation.authoritative, false);
});

test('degrades cleanly when no presentation device is available', () => {
  const result = runSyntheticMicrogrid(fixture, { presentationDevices: [] });
  assert.equal(result.presentation.status, 'no-compatible-device');
  assert.equal(result.presentation.deviceId, null);
  assert.equal(result.presentation.target, null);
  assert.equal(result.simulation.status, 'passed');
  assert.equal(result.promotion.status, 'eligible');
});

test('rejects a presentation target outside the scene renderer contract', () => {
  assert.throws(
    () =>
      runSyntheticMicrogrid(fixture, {
        preferredPresentationTarget: 'physical-grid-control',
      }),
    /target is not supported by the scene/,
  );
});

test('records VÆLON capability and explicit fallback identity', () => {
  const route = createModelRoute({ model: 'VÆLON', version: 'phase-2-contract' });
  const evidence = buildModelEvidence({
    route,
    capability: 'optimization.explore',
    fallbackUsed: true,
  });
  assert.equal(evidence.model, 'VÆLON');
  assert.equal(evidence.fallbackUsed, true);
  assert.equal(evidence.fallbackIdentity, 'classical-reference-v1');
});

test('rejects unsupported model capabilities', () => {
  const route = createModelRoute();
  assert.throws(() => route.resolve('actuate.grid'), /unsupported capability/);
});
