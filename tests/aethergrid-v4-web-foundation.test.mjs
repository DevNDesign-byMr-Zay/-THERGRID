import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 web workspace remains isolated from the verified v3 runtime', async () => {
  const [packageJson, readme] = await Promise.all([
    text('apps/aethergrid-console/web/package.json'),
    text('apps/aethergrid-console/web/README.md')
  ]);

  const packageData = JSON.parse(packageJson);
  assert.equal(packageData.private, true);
  assert.equal(packageData.dependencies.cesium, '1.145.0');
  assert.equal(packageData.dependencies.react, '19.3.0');
  assert.match(readme, /does \*\*not\*\* replace/iu);
  assert.match(readme, /GET \/api\/aethergrid\/config\/public/u);
  assert.doesNotMatch(packageJson, /IBM_QUANTUM_API_KEY|OPENAI_API_KEY|TOMORROW_API_KEY/u);
});

test('v4 spatial renderer has Cesium primary and native fallback contracts', async () => {
  const [contract, cesiumRenderer, nativeRenderer, manager] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/spatial-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-renderer-adapter.ts'),
    text('apps/aethergrid-console/web/src/renderer/renderer-manager.ts')
  ]);

  for (const method of [
    'initialize',
    'flyTo',
    'setTime',
    'setLayers',
    'selectFeature',
    'setVisualMode',
    'pick',
    'resize',
    'destroy'
  ]) {
    assert.match(contract, new RegExp(`\\b${method}\\b`, 'u'));
  }

  assert.match(contract, /'cesium' \| 'native-webgl'/u);
  assert.match(contract, /'holographic'/u);
  assert.match(contract, /'reality'/u);
  assert.match(cesiumRenderer, /Terrain\.fromWorldTerrain/u);
  assert.match(cesiumRenderer, /createOsmBuildingsAsync/u);
  assert.match(cesiumRenderer, /depthTestAgainstTerrain = true/u);
  assert.match(nativeRenderer, /LegacyNativeSpatialBridge/u);
  assert.match(manager, /await this\.#activate\(this\.#primary\)/u);
  assert.match(manager, /await this\.#activate\(this\.#fallback\)/u);
});

test('v4 temporal model separates live, historical, forecast and scenario time', async () => {
  const [model, clock, store, rail] = await Promise.all([
    text('apps/aethergrid-console/web/src/time/temporal-model.ts'),
    text('apps/aethergrid-console/web/src/time/temporal-clock.ts'),
    text('apps/aethergrid-console/web/src/time/temporal-layer-store.ts'),
    text('apps/aethergrid-console/web/src/components/TemporalRail.tsx')
  ]);

  for (const mode of ['live', 'historical', 'forecast', 'scenario']) {
    assert.match(model, new RegExp(`'${mode}'`, 'u'));
  }

  assert.match(model, /eventTime/u);
  assert.match(model, /sourceTime/u);
  assert.match(clock, /setLiveReference/u);
  assert.match(clock, /goLive/u);
  assert.match(clock, /setPlaybackRate/u);
  assert.match(store, /TemporalSampleReport/u);
  assert.match(store, /unsupported/u);
  assert.match(store, /failed/u);
  assert.match(rail, /LIVE NOW/u);
  assert.match(rail, /Time offset from live/u);
});

test('v4 operator shell keeps the spatial viewport dominant and responsive', async () => {
  const [app, viewport, styles] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/components/SpatialViewport.tsx'),
    text('apps/aethergrid-console/web/src/app/app.css')
  ]);

  assert.match(app, /<SpatialViewport/u);
  assert.match(app, /<TemporalRail/u);
  assert.match(app, /AUREN/u);
  assert.match(app, /VÆLON/u);
  assert.match(app, /SOLVÆR/u);
  assert.match(viewport, /new CesiumSpatialRenderer\(\)/u);
  assert.match(viewport, /new NativeSpatialRendererAdapter\(\)/u);
  assert.match(viewport, /loadPublicRuntimeConfig/u);
  assert.match(styles, /grid-template-columns: 220px minmax\(0, 1fr\) 250px/u);
  assert.match(styles, /prefers-reduced-motion/u);
  assert.doesNotMatch(styles, /fonts\.googleapis\.com/u);
});
