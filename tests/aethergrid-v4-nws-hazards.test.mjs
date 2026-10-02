import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 NWS hazards consume the provider route at the active city coordinate', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/nws-hazards.ts');

  assert.match(service, /\/api\/aethergrid\/hazards\/alerts/u);
  assert.match(service, /lat: String\(latitude\)/u);
  assert.match(service, /lon: String\(longitude\)/u);
  assert.match(service, /US National Weather Service/u);
  assert.match(service, /receipt\.live/u);
  assert.match(service, /receipt\.stale/u);
  assert.match(service, /receipt\.fallback/u);
});

test('v4 NWS hazard geometry renders source boundaries without invented affected-area fills', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/nws-hazards.ts');

  assert.match(service, /geometryType === 'Polygon'/u);
  assert.match(service, /geometryType === 'MultiPolygon'/u);
  assert.match(service, /eventType: 'nws-alert-boundary'/u);
  assert.match(service, /boundaryOnly: true/u);
  assert.match(service, /areas: \[\]/u);
  assert.match(service, /MAX_BOUNDARY_EDGES = 2_000/u);
  assert.match(service, /edges\.length >= MAX_BOUNDARY_EDGES/u);
  assert.doesNotMatch(service, /radius|buffer|convexHull|Math\.random/u);
});

test('v4 NWS alerts use point-context markers when polygon geometry is absent', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/nws-hazards.ts');

  assert.match(service, /position: \{ latitude, longitude/u);
  assert.match(service, /appliesAtQueryPoint: true/u);
  assert.match(service, /geometryAvailable/u);
  assert.match(service, /kind: 'event'/u);
});

test('v4 active alert visibility begins at effective time and ends at expiry', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/nws-hazards.ts');

  assert.match(service, /validFrom: alert\.effective \?\? alert\.onset/u);
  assert.match(service, /validTo: alert\.expires/u);
});

test('v4 NWS hazards render consistently in Cesium and native failover', async () => {
  const [cesium, nativeRenderer] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
  ]);

  for (const renderer of [cesium, nativeRenderer]) {
    assert.match(renderer, /nws-alert/u);
    assert.match(renderer, /nws-alert-boundary/u);
    assert.match(renderer, /severity/u);
  }
  assert.match(cesium, /clampToGround/u);
  assert.match(nativeRenderer, /hazardHex/u);
});

test('v4 NWS hazard scene layer is live-only and excluded on fallback receipts', async () => {
  const [app, presets] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/app/use-case-presets.ts'),
  ]);

  assert.match(app, /loadNwsHazards/u);
  assert.match(app, /temporal\.mode !== 'live'/u);
  assert.match(app, /globalThis\.setInterval\(refresh, 60_000\)/u);
  assert.match(app, /!hazardContext\.fallback/u);
  assert.match(app, /NWS ACTIVE HAZARDS/u);
  assert.match(app, /\{ id: 'hazards', visible: true \}/u);
  assert.match(presets, /'hazards'/u);
});
