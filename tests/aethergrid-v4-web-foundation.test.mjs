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
    text('apps/aethergrid-console/web/README.md'),
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
  const [contract, cesiumRenderer, geodeticGrid, nativeRenderer, manager] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/spatial-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/geodetic-grid-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-renderer-adapter.ts'),
    text('apps/aethergrid-console/web/src/renderer/renderer-manager.ts'),
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
    'destroy',
  ]) {
    assert.match(contract, new RegExp(`\\b${method}\\b`, 'u'));
  }

  assert.match(contract, /'cesium' \| 'native-webgl'/u);
  assert.match(contract, /'holographic'/u);
  assert.match(contract, /'reality'/u);
  assert.match(cesiumRenderer, /Terrain\.fromWorldTerrain/u);
  assert.match(cesiumRenderer, /createOsmBuildingsAsync/u);
  assert.match(cesiumRenderer, /depthTestAgainstTerrain = true/u);
  assert.match(cesiumRenderer, /GeodeticGridLayer/u);
  assert.match(geodeticGrid, /Cartesian3\.fromDegrees/u);
  assert.match(geodeticGrid, /setTime\(isoTime/u);
  assert.match(geodeticGrid, /setVisualMode\(mode/u);
  assert.match(geodeticGrid, /this\.#mode === 'holographic'/u);
  assert.match(geodeticGrid, /Math\.sin/u);
  assert.match(nativeRenderer, /LegacyNativeSpatialBridge/u);
  assert.match(manager, /await this\.#activate\(this\.#primary\)/u);
  assert.match(manager, /await this\.#activate\(this\.#fallback\)/u);
});

test('v4 temporal model separates live, historical, forecast and scenario time', async () => {
  const [model, clock, store, rail] = await Promise.all([
    text('apps/aethergrid-console/web/src/time/temporal-model.ts'),
    text('apps/aethergrid-console/web/src/time/temporal-clock.ts'),
    text('apps/aethergrid-console/web/src/time/temporal-layer-store.ts'),
    text('apps/aethergrid-console/web/src/components/TemporalRail.tsx'),
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
    text('apps/aethergrid-console/web/src/app/app.css'),
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

test('v4 camera journey preserves one WGS84 scene from globe to district', async () => {
  const camera = await text(
    'apps/aethergrid-console/web/src/renderer/cesium/camera-journey-controller.ts',
  );

  assert.match(camera, /phase: 'global'/u);
  assert.match(camera, /phase: 'regional'/u);
  assert.match(camera, /phase: 'city'/u);
  assert.match(camera, /phase: 'district'/u);
  assert.match(camera, /11_000_000/u);
  assert.match(camera, /Cartesian3\.fromDegrees/u);
  assert.match(camera, /this\.#camera\.flyTo/u);
  assert.doesNotMatch(camera, /scene\s*=|new Viewer/u);
});

test('v4 source-backed power overlay preserves live and fallback provenance', async () => {
  const [overlayContract, adapter, cesiumLayer, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/overlays/spatial-overlay.ts'),
    text('apps/aethergrid-console/web/src/services/city-power-overlay.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(overlayContract, /eventTime/u);
  assert.match(overlayContract, /sourceTime/u);
  assert.match(overlayContract, /fallback/u);
  assert.match(adapter, /\/api\/aethergrid\/geospatial\/city\//u);
  assert.match(adapter, /source\.live === true/u);
  assert.match(adapter, /upstreamTimestamp/u);
  assert.match(adapter, /localMetersToCoordinate/u);
  assert.match(cesiumLayer, /CustomDataSource/u);
  assert.match(cesiumLayer, /PolylineGraphics/u);
  assert.match(cesiumLayer, /PointGraphics/u);
  assert.match(app, /<DataSourceBadge/u);
  assert.match(app, /\? 'OSM POWER'/u);
  assert.match(app, /\? 'unavailable'/u);
  assert.match(app, /\? 'live'/u);
  assert.match(app, /\? 'fallback'/u);
  assert.match(app, /: 'loading'/u);
});

test('v4 streamed 3D buildings have actual visual-mode styling', async () => {
  const controller = await text(
    'apps/aethergrid-console/web/src/renderer/cesium/visual-mode-controller.ts',
  );

  assert.match(controller, /Cesium3DTileStyle/u);
  assert.match(controller, /mode === 'xray'/u);
  assert.match(controller, /mode === 'holographic'/u);
  assert.match(controller, /mode === 'reality'/u);
  assert.match(controller, /Reality mode requires a configured photorealistic 3D Tiles provider/u);
});

test('v4 live atmosphere is source-backed and drives Cesium clouds and fog', async () => {
  const [contract, service, weatherLayer, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/overlays/atmospheric-overlay.ts'),
    text('apps/aethergrid-console/web/src/services/city-environment.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/weather-atmosphere-layer.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(contract, /weatherPhenomenon/u);
  assert.match(contract, /'rain'/u);
  assert.match(contract, /'snow'/u);
  assert.match(contract, /'fog'/u);
  assert.match(service, /\/api\/aethergrid\/environment/u);
  assert.match(service, /source\.live === true/u);
  assert.match(service, /modelTimeToIso/u);
  assert.match(weatherLayer, /CloudCollection/u);
  assert.match(weatherLayer, /scene\.fog\.density/u);
  assert.match(weatherLayer, /visualDensityScalar/u);
  assert.match(weatherLayer, /cloudCoverPercent/u);
  assert.match(weatherLayer, /windDirectionDegrees/u);
  assert.match(weatherLayer, /ParticleSystem/u);
  assert.match(weatherLayer, /BoxEmitter/u);
  assert.match(weatherLayer, /time\.mode !== 'live'/u);
  assert.match(app, /ATMOSPHERE/u);
  assert.match(app, /loadCityEnvironment/u);
  assert.match(
    app,
    /Current weather visuals are hidden until a source supports the selected time/u,
  );
});

test('v4 appearance preserves dark light system preferences without provider coupling', async () => {
  const [appearance, app, styles] = await Promise.all([
    text('apps/aethergrid-console/web/src/hooks/use-appearance.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/app/app.css'),
  ]);

  assert.match(appearance, /aethergrid\.operator\.settings\.v2/u);
  assert.match(appearance, /'dark' \| 'light' \| 'system'/u);
  assert.match(appearance, /prefers-color-scheme: light/u);
  assert.match(app, /appearance\.cycle/u);
  assert.match(styles, /data-theme='light'/u);
});

test('v4 world search supports named cities and arbitrary real coordinates', async () => {
  const [app, powerService] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/services/city-power-overlay.ts'),
  ]);

  assert.match(app, /navigateSearch/u);
  assert.match(app, /latitude >= -90 && latitude <= 90/u);
  assert.match(app, /longitude >= -180 && longitude <= 180/u);
  assert.match(app, /City or lat, lon/u);
  assert.match(app, /custom: true/u);
  assert.match(powerService, /loadCoordinatePowerOverlay/u);
  assert.match(powerService, /\/api\/aethergrid\/geospatial\/point/u);
});

test('v4 coordinate navigation remains available on mobile', async () => {
  const styles = await text('apps/aethergrid-console/web/src/app/app.css');
  const mobile = styles.slice(styles.indexOf('@media (max-width: 760px)'));
  assert.match(mobile, /\.global-search \{\s*display: grid/u);
  assert.doesNotMatch(mobile, /\.global-search \{\s*display: none/u);
});

test('v4 spatial selection visibly highlights real features and can be cleared', async () => {
  const [renderer, viewport, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
    text('apps/aethergrid-console/web/src/components/SpatialViewport.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(renderer, /selectionIndicator: true/u);
  assert.match(renderer, /#selectedTile/u);
  assert.match(renderer, /picked\.color = Color\.fromCssColorString/u);
  assert.match(renderer, /viewer\.selectedEntity = entity/u);
  assert.match(renderer, /#clearSelection/u);
  assert.match(viewport, /event\.key !== 'Escape'/u);
  assert.match(viewport, /manager\.selectFeature\(null\)/u);
  assert.match(app, /ESC TO CLEAR/u);
});

test('v4 provenance UI separates source time from retrieval age', async () => {
  const [badge, freshness, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/components/DataSourceBadge.tsx'),
    text('apps/aethergrid-console/web/src/utils/data-freshness.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(badge, /formatSourceTime/u);
  assert.match(badge, /formatDataAge/u);
  assert.match(badge, /FETCHED/u);
  assert.match(freshness, /UNKNOWN AGE/u);
  assert.match(freshness, /JUST NOW/u);
  assert.match(app, /sourceTime=\{powerOverlay\?\.sourceTime\}/u);
  assert.match(app, /FETCHED \{formatDataAge\(atmosphere\?\.fetchedAt\)\}/u);
});

test('v4 city-live context renders source-backed AQI and seismic events only in LIVE mode', async () => {
  const [service, layer, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/city-live-context.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(service, /\/api\/aethergrid\/city-live/u);
  assert.match(service, /seismicToOverlay/u);
  assert.match(service, /layerId: 'seismic'/u);
  assert.match(service, /usAqi/u);
  assert.match(service, /pm25UgM3/u);
  assert.match(layer, /eventType === 'earthquake'/u);
  assert.match(layer, /#ff7b63/u);
  assert.match(app, /AIR QUALITY/u);
  assert.match(app, /AQI /u);
  assert.match(app, /temporal\.mode === 'live' \? seismicToOverlay/u);
  assert.match(app, /Current AQI and seismic context are hidden outside LIVE mode/u);
});
