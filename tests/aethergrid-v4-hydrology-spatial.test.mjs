import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);
async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 NOAA hydrology adapter renders only source-supplied gauge coordinates', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/noaa-hydrology.ts');

  assert.match(service, /\/api\/aethergrid\/hydrology\/gauges/u);
  assert.match(service, /new URLSearchParams\(\{ gaugeId: cleanGaugeId \}\)/u);
  assert.match(service, /latitude: finite\(data\.latitude\)/u);
  assert.match(service, /longitude: finite\(data\.longitude\)/u);
  assert.match(service, /validCoordinate\(gauge\.latitude, gauge\.longitude\)/u);
  assert.match(service, /eventType: 'noaa-nwps-gauge'/u);
  assert.match(service, /layerId: 'hydrology'/u);
  assert.doesNotMatch(service, /nearest|Math\.random|radius|buffer|interpolat/iu);
});

test('v4 NOAA gauge state derives flood bands only from observed stage and provider thresholds', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/noaa-hydrology.ts');

  assert.match(service, /observedStageFeet/u);
  assert.match(service, /actionStageFeet/u);
  assert.match(service, /minorFloodStageFeet/u);
  assert.match(service, /moderateFloodStageFeet/u);
  assert.match(service, /majorFloodStageFeet/u);
  assert.match(service, /stage >= gauge\.majorFloodStageFeet/u);
  assert.match(service, /stage >= gauge\.moderateFloodStageFeet/u);
  assert.match(service, /stage >= gauge\.minorFloodStageFeet/u);
  assert.match(service, /stage >= gauge\.actionStageFeet/u);
  assert.match(service, /const partial = gauge\.status\?\.includes\('Partial'\) === true/u);
});

test('v4 NOAA gauge binding is coordinate-scoped and live-only in the scene', async () => {
  const [bindings, panel, app, badges] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/operational-source-bindings.ts'),
    text('apps/aethergrid-console/web/src/components/OperationalDataPanel.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/components/LiveSceneBadges.tsx'),
  ]);

  assert.match(bindings, /OPERATIONAL_SOURCE_BINDINGS_EVENT/u);
  assert.doesNotMatch(bindings, /latitude|longitude|geocode/u);
  assert.match(panel, /latitude\.toFixed\(5\)/u);
  assert.match(panel, /longitude\.toFixed\(5\)/u);
  assert.match(app, /city\.latitude\.toFixed\(5\)/u);
  assert.match(app, /city\.longitude\.toFixed\(5\)/u);
  assert.match(app, /loadOperationalSourceBindings/u);
  assert.match(app, /OPERATIONAL_SOURCE_BINDINGS_EVENT/u);
  assert.match(app, /loadNoaaHydrologyContext/u);
  assert.match(app, /scope !== 'city'/u);
  assert.match(app, /temporal\.mode !== 'live'/u);
  assert.match(app, /!operationalBindings\.gaugeId/u);
  assert.match(app, /hydrologyOverlay/u);
  assert.match(app, /<LiveSceneBadges/u);
  assert.match(badges, /NOAA NWPS/u);
  assert.match(badges, /PARTIAL · METADATA SOURCE LIVE/u);
});

test('v4 NOAA hydrology layer is available to both renderer engines and operational presets', async () => {
  const [cesium, nativeRenderer, presets, styles, palette] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
    text('apps/aethergrid-console/web/src/app/use-case-presets.ts'),
    text('apps/aethergrid-console/web/src/app/app.css'),
    text('apps/aethergrid-console/web/src/renderer/overlays/color-mapping.ts'),
  ]);

  assert.match(palette, /noaa-nwps-gauge/u);
  assert.match(palette, /hydrologyColor/u);
  assert.match(cesium, /nodeColor/u);
  assert.match(nativeRenderer, /noaa-nwps-gauge/u);
  assert.match(nativeRenderer, /hydrologyHex/u);
  assert.match(presets, /'hydrology'/u);
  assert.match(styles, /\.hydrology-scene-badge/u);
});
