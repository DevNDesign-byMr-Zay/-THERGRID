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
  assert.match(viewport, /new NativeWebglSpatialRenderer\(\)/u);
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
  assert.match(viewport, /addEventListener\('click', onPointer\)/u);
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
  assert.match(app, /sourceTime=\{/u);
  assert.match(app, /globalLive\?\.overlay\.sourceTime/u);
  assert.match(app, /powerOverlay\?\.sourceTime/u);
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
  assert.match(
    app,
    /scope === 'city' && liveContext && temporal\.mode === 'live'[\s\S]*seismicToOverlay\(liveContext\)/u,
  );
  assert.match(app, /Current AQI and seismic context are hidden outside LIVE mode/u);
});

test('v4 Cesium city identity includes mapped roads water coastline and green areas', async () => {
  const [contract, service, layer, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/overlays/spatial-overlay.ts'),
    text('apps/aethergrid-console/web/src/services/city-power-overlay.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(contract, /OverlayAreaKind = 'water' \| 'green'/u);
  assert.match(service, /cityMeshToSemanticOverlays/u);
  assert.match(service, /layerId: 'roads'/u);
  assert.match(service, /layerId: 'water'/u);
  assert.match(service, /layerId: 'green'/u);
  assert.match(service, /loadCitySpatialBundle/u);
  assert.match(service, /loadCoordinateSpatialBundle/u);
  assert.match(layer, /PolygonGraphics/u);
  assert.match(layer, /PolygonHierarchy/u);
  assert.match(layer, /edge\.kind === 'coastline'/u);
  assert.match(layer, /edge\.kind === 'waterway'/u);
  assert.match(app, /id: 'roads', visible: true/u);
  assert.match(app, /id: 'water', visible: true/u);
  assert.match(app, /id: 'green', visible: true/u);
});

test('v4 city inspector surfaces source-backed skyline identity and coverage', async () => {
  const [service, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/city-power-overlay.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(service, /CityIdentitySummary/u);
  assert.match(service, /sourceBackedHeightCoveragePercent/u);
  assert.match(service, /namedStructures/u);
  assert.match(service, /cityIdentity\(mesh/u);
  assert.match(app, /CITY IDENTITY/u);
  assert.match(app, /SKYLINE MAX/u);
  assert.match(app, /HEIGHT COVERAGE/u);
  assert.match(app, /cityIdentity\?\.namedStructures/u);
});

test('v4 spatial AI dock calls real agent endpoints with scene context and receipts', async () => {
  const [client, dock, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/agent-client.ts'),
    text('apps/aethergrid-console/web/src/components/AgentDock.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(client, /\/api\/aethergrid\/team/u);
  assert.match(client, /\/api\/aethergrid\/agents\//u);
  assert.match(client, /fallbackUsed/u);
  assert.match(client, /history: history\.slice\(-12\)/u);
  assert.match(dock, /ADVISORY ONLY/u);
  assert.match(dock, /lastRun\.runtime\.provider/u);
  assert.match(dock, /lastRun\.receipt\.slice/u);
  assert.match(app, /temporalCursor: temporal\.cursorIso/u);
  assert.match(app, /selectedEntity/u);
  assert.match(app, /cityIdentity/u);
  assert.match(app, /<AgentDock context=\{agentContext\}/u);
});

test('v4 intelligence rail remains usable as a tablet and mobile drawer', async () => {
  const [app, styles] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/app/app.css'),
  ]);

  assert.match(app, /aria-controls="aethergrid-intelligence-rail"/u);
  assert.match(app, /setIntelOpen/u);
  assert.match(app, /intel-rail open/u);
  assert.match(styles, /\.intel-toggle \{/u);
  assert.match(styles, /\.intel-rail\.open \{/u);
  assert.match(styles, /transform: translateX\(105%\)/u);
  assert.match(styles, /transform: translateY\(105%\)/u);
});

test('v4 quantum panel distinguishes local simulation submitted QPU and executed QPU states', async () => {
  const [client, panel, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/quantum-client.ts'),
    text('apps/aethergrid-console/web/src/components/QuantumPanel.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(client, /\/api\/aethergrid\/quantum\/runtime/u);
  assert.match(client, /\/api\/aethergrid\/quantum\/backends/u);
  assert.match(client, /\/api\/aethergrid\/quantum\/jobs/u);
  assert.match(client, /OPENQASM 3\.0/u);
  assert.match(panel, /HARDWARE EXECUTED/u);
  assert.match(panel, /HARDWARE SUBMITTED/u);
  assert.match(panel, /LOCAL COMPLETED/u);
  assert.match(panel, /globalThis\.confirm/u);
  assert.match(panel, /SUBMIT BELL TEST TO QPU/u);
  assert.match(panel, /RUN LOCAL BELL TEST/u);
  assert.match(app, /<QuantumPanel/u);
});

test('v4 evidence panel reviews receipts and exports a real JSON package', async () => {
  const [client, panel, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/evidence-client.ts'),
    text('apps/aethergrid-console/web/src/components/EvidencePanel.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(client, /\/api\/aethergrid\/evidence/u);
  assert.match(client, /\/api\/aethergrid\/export/u);
  assert.match(client, /new Blob/u);
  assert.match(client, /URL\.createObjectURL/u);
  assert.match(panel, /PROVENANCE LEDGER/u);
  assert.match(panel, /EXPORT EVIDENCE JSON/u);
  assert.match(panel, /loadEvidenceRecord/u);
  assert.match(app, /<EvidencePanel/u);
});

test('v4 scenario controls synchronize bounded server scenarios with 4d time', async () => {
  const [client, panel, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/scenario-client.ts'),
    text('apps/aethergrid-console/web/src/components/ScenarioPanel.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(client, /\/api\/aethergrid\/scenario/u);
  assert.match(client, /\/api\/aethergrid\/view/u);
  assert.match(panel, /min="70"/u);
  assert.match(panel, /max="150"/u);
  assert.match(panel, /min="40"/u);
  assert.match(panel, /max="160"/u);
  assert.match(panel, /EVIDENCE RECEIPT/u);
  assert.match(panel, /RETURN LIVE/u);
  assert.match(app, /clock\.setMode\('scenario', scenarioId\)/u);
  assert.match(app, /onReturnLive=\{\(\) => clock\.goLive\(\)\}/u);
});

test('v4 runtime diagnostics report provider readiness without exposing credentials', async () => {
  const [client, panel, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/runtime-client.ts'),
    text('apps/aethergrid-console/web/src/components/RuntimeDiagnosticsPanel.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(client, /\/api\/aethergrid\/runtime/u);
  assert.match(panel, /PROVIDER DIAGNOSTICS/u);
  assert.match(panel, /CLIENT SECRET EXPOSURE/u);
  assert.match(panel, /credentialsExposed/u);
  assert.match(panel, /NONE REPORTED/u);
  assert.doesNotMatch(panel, /API_KEY|apikey|Bearer /u);
  assert.match(app, /<RuntimeDiagnosticsPanel/u);
});

test('v4 God’s-eye mode renders live global city AQI and seismic context', async () => {
  const [service, app, camera] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/global-live-context.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/renderer/cesium/camera-journey-controller.ts'),
  ]);

  assert.match(service, /\/api\/aethergrid\/global-live/u);
  assert.match(service, /layerId: 'world'/u);
  assert.match(service, /kind: 'city'/u);
  assert.match(service, /eventType: 'earthquake'/u);
  assert.match(app, /GLOBAL GOD’S-EYE/u);
  assert.match(app, /scope === 'world'/u);
  assert.match(app, /setScope\('world'\)/u);
  assert.match(app, /journey: 'global'/u);
  assert.match(camera, /target\.journey === 'global'/u);
});

test('v4 operator profile persists real identity and bounded local avatar data', async () => {
  const [client, menu, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/profile-client.ts'),
    text('apps/aethergrid-console/web/src/components/ProfileMenu.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(client, /\/api\/aethergrid\/profile/u);
  assert.match(client, /method: 'PUT'/u);
  assert.match(menu, /256/u);
  assert.match(menu, /image\/webp/u);
  assert.match(menu, /180_000/u);
  assert.match(menu, /LOCAL PROFILE · NO PROVIDER SECRETS/u);
  assert.match(app, /<ProfileMenu/u);
});

test('v4 world scope isolates global live context from selected-city overlays', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /scope === 'world'\s*\? \[worldOverlay, measurementOverlay\]/u);
  assert.match(
    app,
    /atmosphere=\{\s*scope === 'city' && temporal\.mode === 'live' \? atmosphere : null\s*\}/u,
  );
  assert.match(app, /scope === 'world'\s*\? \{\s*latitude: 20,\s*longitude: 0/u);
  assert.match(app, /scope === 'city' && cityIdentity/u);
  assert.match(app, /scope === 'city' && atmosphere/u);
  assert.match(app, /scope === 'city' && liveContext/u);
});

test('v4 God’s-eye city nodes encode AQI categories and descend into selected cities', async () => {
  const [layer, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(layer, /node\.kind === 'city'/u);
  assert.match(layer, /category === 'good'/u);
  assert.match(layer, /category === 'hazardous'/u);
  assert.match(app, /handleSpatialSelection/u);
  assert.match(app, /scope !== 'world' \|\| bound\?\.kind !== 'city'/u);
  assert.match(app, /bound\.properties\?\.cityId/u);
  assert.match(app, /setScope\('city'\)/u);
  assert.match(app, /onSelection=\{handleSpatialSelection\}/u);
});

test('v4 operator shortcuts keep world city live intel and search keyboard-accessible', async () => {
  const [shortcuts, app, styles] = await Promise.all([
    text('apps/aethergrid-console/web/src/hooks/use-operator-shortcuts.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/app/app.css'),
  ]);

  assert.match(shortcuts, /event\.metaKey \|\| event\.ctrlKey/u);
  assert.match(shortcuts, /key === 'g'/u);
  assert.match(shortcuts, /key === 'c'/u);
  assert.match(shortcuts, /key === 'l'/u);
  assert.match(shortcuts, /key === 'i'/u);
  assert.match(shortcuts, /editableTarget/u);
  assert.match(app, /searchInputRef\.current\?\.focus/u);
  assert.match(app, /<kbd aria-hidden="true">⌘K<\/kbd>/u);
  assert.match(styles, /grid-template-columns: 24px 1fr auto auto/u);
});

test('v4 semantic overlays use camera-distance LOD while global nodes remain orbital', async () => {
  const layer = await text(
    'apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts',
  );

  assert.match(layer, /DistanceDisplayCondition/u);
  assert.match(layer, /node\.kind === 'city' \|\| node\.kind === 'event'/u);
  assert.match(layer, /return 30_000_000/u);
  assert.match(layer, /edge\.kind === 'route'/u);
  assert.match(layer, /return 80_000/u);
  assert.match(layer, /area\.kind === 'water' \? 100_000 : 80_000/u);
  assert.match(layer, /Number\.POSITIVE_INFINITY/u);
});

test('v4 AIR toggle renders a source-driven AQI field only for live city context', async () => {
  const [contract, service, layer, renderer, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/overlays/atmospheric-overlay.ts'),
    text('apps/aethergrid-console/web/src/services/city-live-context.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/air-quality-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(contract, /AirQualityOverlaySnapshot/u);
  assert.match(service, /airQualityToOverlay/u);
  assert.match(layer, /ParticleSystem/u);
  assert.match(layer, /current\.usAqi/u);
  assert.match(layer, /current\.pm25UgM3/u);
  assert.match(layer, /this\.#temporalMode === 'live'/u);
  assert.match(renderer, /this\.#layerVisible\('air', true\)/u);
  assert.match(app, /scope === 'city' && liveContext && temporal\.mode === 'live'/u);
  assert.match(app, /airQuality=\{airQualityOverlay\}/u);
});

test('v4 layer controls expose only implemented layers with live feature counts', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /const layerCounts = useMemo/u);
  assert.match(app, /powerOverlay\.nodes\.length \+ powerOverlay\.edges\.length/u);
  assert.match(app, /cityIdentity\?\.buildingCount/u);
  assert.match(app, /layerCounts\[layer\.id\] \?\? 0/u);
  assert.doesNotMatch(app, /id: 'transit'/u);
});

test('v4 intelligence workspace tabs preserve mounted AI scenario quantum evidence and system state', async () => {
  const [app, styles] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/app/app.css'),
  ]);

  assert.match(app, /data-workspace=\{intelWorkspace\}/u);
  assert.match(app, /CONTEXT/u);
  assert.match(app, /SCENARIO/u);
  assert.match(app, /QUANTUM/u);
  assert.match(app, /EVIDENCE/u);
  assert.match(app, /SYSTEM/u);
  assert.match(app, /intel-workspace intel-ai/u);
  assert.match(app, /intel-workspace intel-quantum/u);
  assert.match(styles, /\.intel-workspace,\s*\.intel-context-panel \{\s*display: none/u);
  assert.match(styles, /data-workspace='ai'/u);
  assert.match(styles, /data-workspace='evidence'/u);
});

test('v4 4d solar lighting responds to time and geographic target', async () => {
  const [solar, lighting, renderer] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/solar-position.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/solar-lighting-controller.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
  ]);

  assert.match(solar, /solarStateAt/u);
  assert.match(solar, /equationOfTime/u);
  assert.match(solar, /declination/u);
  assert.match(solar, /golden-hour/u);
  assert.match(solar, /twilight/u);
  assert.match(lighting, /JulianDate\.fromIso8601/u);
  assert.match(lighting, /sky\.brightnessShift/u);
  assert.match(lighting, /sky\.saturationShift/u);
  assert.match(renderer, /new SolarLightingController/u);
  assert.match(renderer, /this\.#solarLighting\?\.setTarget/u);
  assert.match(renderer, /this\.#solarLighting\?\.setTime/u);
});

test('v4 camera descent exposes live phase and adaptive terrain building detail', async () => {
  const [camera, renderer, viewport] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/camera-journey-controller.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
    text('apps/aethergrid-console/web/src/components/SpatialViewport.tsx'),
  ]);

  assert.match(camera, /onPhase\?\./u);
  assert.match(renderer, /terrainSse: 5\.2/u);
  assert.match(renderer, /buildingSse: 30/u);
  assert.match(renderer, /terrainSse: 1\.4/u);
  assert.match(renderer, /buildingSse: 10/u);
  assert.match(renderer, /maximumScreenSpaceError/u);
  assert.match(renderer, /journeyPhase/u);
  assert.match(renderer, /detailLevel/u);
  assert.match(viewport, /SPATIAL TRANSITION/u);
  assert.match(viewport, /journey-progress/u);
  assert.match(viewport, /localSolarHour/u);
});

test('v4 viewport prevents duplicate initial camera descent while polling transition status', async () => {
  const viewport = await text('apps/aethergrid-console/web/src/components/SpatialViewport.tsx');

  assert.match(viewport, /lastJourneyKeyRef/u);
  assert.match(viewport, /if \(lastJourneyKeyRef\.current === targetKey\) return/u);
  assert.match(viewport, /setInterval\(\(\) => \{/u);
  assert.match(viewport, /manager\.status\(\)/u);
});

test('v4 city transitions report geometry atmosphere and live-context readiness independently', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /interface CityLoadState/u);
  assert.match(app, /spatial: true/u);
  assert.match(app, /environment: true/u);
  assert.match(app, /liveContext: true/u);
  assert.match(app, /SOURCES PENDING/u);
  assert.match(app, /GEOMETRY/u);
  assert.match(app, /ATMOSPHERE/u);
  assert.match(app, /LIVE CONTEXT/u);
  assert.match(app, /setCityLoad\(\(current\) => \(\{ \.\.\.current, spatial: false \}\)\)/u);
});

test('v4 streamed 3d buildings defer until city or district detail', async () => {
  const renderer = await text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts');

  assert.match(renderer, /#buildingsShouldShow/u);
  assert.match(renderer, /this\.#detailLevel === 'city'/u);
  assert.match(renderer, /this\.#detailLevel === 'district'/u);
  assert.match(renderer, /this\.#buildings\.show = this\.#buildingsShouldShow\(\)/u);
});

test('v4 solid building presentation responds to solar phase without affecting synthetic modes', async () => {
  const [visual, renderer] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/visual-mode-controller.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
  ]);

  assert.match(visual, /setSolarPhase/u);
  assert.match(visual, /this\.#solarPhase === 'golden-hour'/u);
  assert.match(visual, /this\.#solarPhase === 'twilight'/u);
  assert.match(visual, /this\.#solarPhase === 'night'/u);
  assert.match(visual, /#e4a35b/u);
  assert.match(renderer, /setSolarPhase\(this\.#solar\.phase\)/u);
});

test('v4 city descent uses a true heading pitch range orbit around the geographic target', async () => {
  const camera = await text(
    'apps/aethergrid-console/web/src/renderer/cesium/camera-journey-controller.ts',
  );

  assert.match(camera, /BoundingSphere/u);
  assert.match(camera, /HeadingPitchRange/u);
  assert.match(camera, /flyToBoundingSphere/u);
  assert.match(camera, /target\.heightMeters \?\? 0/u);
  assert.match(camera, /stage\.destinationHeightMeters/u);
});

test('v4 city arrival heading is derived from mapped building geometry and applied as a direct reframe', async () => {
  const [service, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/city-power-overlay.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(service, /interface CityBuilding/u);
  assert.match(service, /arrivalHeadingDegrees\(mesh/u);
  assert.match(service, /Math\.atan2/u);
  assert.match(service, /mesh\.buildings/u);
  assert.match(app, /cityIdentity\?\.cityId === city\.id/u);
  assert.match(app, /cityIdentity\.arrivalHeadingDegrees/u);
  assert.match(app, /journey: identityMatches \? 'direct' : 'full'/u);
  assert.match(app, /ARRIVAL HEADING/u);
});

test('v4 scenario map effects mirror the backend stress model without mutating source data', async () => {
  const [client, panel, layer, renderer, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/scenario-client.ts'),
    text('apps/aethergrid-console/web/src/components/ScenarioPanel.tsx'),
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(client, /stressFactor: 0\.88/u);
  assert.match(client, /stressFactor: 1\.12/u);
  assert.match(client, /stressFactor: 1\.18/u);
  assert.match(client, /parameters\.weatherRiskPercent \/ 1000/u);
  assert.match(panel, /scenarioVisualState/u);
  assert.match(panel, /activeVisual\.stressFactor/u);
  assert.match(layer, /time\.mode === 'scenario'/u);
  assert.match(layer, /scenario\.stressFactor/u);
  assert.match(layer, /scenarioColor/u);
  assert.match(renderer, /if \(this\.#time\) overlay\.setTime\(this\.#time\)/u);
  assert.match(app, /MODELED SCENARIO · SOURCE DATA UNCHANGED/u);
});

test('v4 selected spatial entities expose layer provenance and hand off to AI context', async () => {
  const [layer, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(layer, /provenanceProperties/u);
  assert.match(layer, /sourceTime: snapshot\.sourceTime/u);
  assert.match(layer, /fetchedAt: snapshot\.fetchedAt/u);
  assert.match(layer, /fallback: snapshot\.fallback/u);
  assert.match(app, /ANALYZE WITH AI/u);
  assert.match(app, /setIntelWorkspace\('ai'\)/u);
  assert.match(app, /selection\.properties\?\.sourceTime/u);
  assert.match(app, /selection\.properties\?\.fetchedAt/u);
});

test('v4 selected-entity AI handoff prefills AUREN without automatic submission', async () => {
  const [dock, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/components/AgentDock.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(dock, /AgentHandoffRequest/u);
  assert.match(dock, /setAgent\(handoff\.agent\)/u);
  assert.match(dock, /setDraft\(handoff\.prompt\)/u);
  assert.match(dock, /textareaRef\.current\?\.focus/u);
  assert.doesNotMatch(dock, /handoff[\s\S]{0,220}void submit\(\)/u);
  assert.match(app, /agent: 'AUREN'/u);
  assert.match(app, /Separate observed facts, modeled context, assumptions, uncertainty/u);
  assert.match(app, /<AgentDock context=\{agentContext\} handoff=\{agentHandoff\}/u);
});

test('v4 operational presets use only implemented layers and preserve manual custom control', async () => {
  const [presets, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/use-case-presets.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(presets, /grid-resilience/u);
  assert.match(presets, /environmental/u);
  assert.match(presets, /seismic-response/u);
  assert.match(presets, /skyline-analysis/u);
  assert.doesNotMatch(presets, /transit/u);
  assert.doesNotMatch(presets, /hydrology/u);
  assert.match(app, /const applyUseCase = \(preset: UseCasePreset\)/u);
  assert.match(app, /visible: preset\.layers\.includes\(layer\.id\)/u);
  assert.match(app, /setActiveUseCase\(null\)/u);
  assert.match(app, /CUSTOM · manually controlled layers and view/u);
});

test('v4 operational mode propagates into spatial HUD and AI context', async () => {
  const [client, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/agent-client.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(client, /useCase\?: string \| null/u);
  assert.match(app, /useCase: activeUseCase/u);
  assert.match(app, /OPERATION MODE/u);
  assert.match(app, /USE_CASE_PRESETS\.find\(\(preset\) => preset\.id === activeUseCase\)/u);
});

test('v4 saved views restore spatial layers use case and exact 4d cursor without server mutation', async () => {
  const [service, panel, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/view-bookmarks.ts'),
    text('apps/aethergrid-console/web/src/components/ViewBookmarksPanel.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(service, /aethergrid\.operator\.spatial-bookmarks\.v4/u);
  assert.match(service, /cursorIso/u);
  assert.match(service, /scenarioVisual/u);
  assert.match(panel, /createSpatialBookmark/u);
  assert.match(panel, /saveSpatialBookmarks/u);
  assert.match(app, /const restoreBookmark = \(bookmark: SpatialViewBookmark\)/u);
  assert.match(app, /clock\.scrub\(bookmark\.cursorIso, 'scenario'\)/u);
  assert.match(app, /clock\.scrub\(bookmark\.cursorIso, bookmark\.temporalMode\)/u);
  assert.doesNotMatch(app, /restoreBookmark[\s\S]{0,1000}applyScenario\(/u);
});

test('v4 scenario comparison ghosts preserve source baseline beside modeled power routes', async () => {
  const [layer, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(layer, /scenarioGhostEntity/u);
  assert.match(layer, /source-baseline/u);
  assert.match(layer, /snapshot\.layerId === 'energy'/u);
  assert.match(layer, /ghost\.show =\s*Boolean\(scenario\)/u);
  assert.match(app, /DIM = SOURCE BASELINE · BRIGHT = MODELED SCENARIO/u);
});

test('v4 native failover is a real source-backed WebGL renderer rather than an empty adapter', async () => {
  const [nativeRenderer, viewport] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
    text('apps/aethergrid-console/web/src/components/SpatialViewport.tsx'),
  ]);

  assert.match(nativeRenderer, /class NativeWebglSpatialRenderer implements SpatialRenderer/u);
  assert.match(nativeRenderer, /getContext\('webgl'/u);
  assert.match(nativeRenderer, /getContext\('2d'\)/u);
  assert.match(nativeRenderer, /gl\.drawArrays/u);
  assert.match(nativeRenderer, /this\.#overlays\.set\(snapshot\.layerId, snapshot\)/u);
  assert.match(nativeRenderer, /this\.#time\.mode === 'scenario'/u);
  assert.match(nativeRenderer, /solarStateAt/u);
  assert.match(nativeRenderer, /#pickEdge/u);
  assert.match(nativeRenderer, /WebGL unavailable; using Canvas2D source-overlay fallback/u);
  assert.match(viewport, /new NativeWebglSpatialRenderer\(\)/u);
  assert.doesNotMatch(viewport, /new NativeSpatialRendererAdapter\(\)/u);
});

test('v4 renderer switching is reversible and preserves safe fallback diagnostics', async () => {
  const [manager, viewport] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/renderer-manager.ts'),
    text('apps/aethergrid-console/web/src/components/SpatialViewport.tsx'),
  ]);

  assert.match(manager, /#failoverReason/u);
  assert.match(manager, /Cesium unavailable ·/u);
  assert.match(manager, /await this\.#activate\(this\.#fallback\)/u);
  assert.match(
    manager,
    /for \(const snapshot of this\.#overlays\.values\(\)\) renderer\.applyOverlay/u,
  );
  assert.match(manager, /if \(this\.#time\) renderer\.setTime\(this\.#time\)/u);
  assert.match(viewport, /renderer-engine-switch/u);
  assert.match(viewport, /CESIUM/u);
  assert.match(viewport, /NATIVE/u);
  assert.match(viewport, /await manager\.use\(engine\)/u);
  assert.match(viewport, /await manager\.flyTo\(target\)/u);
});

test('v4 temporal modes hide current-only environment feeds outside live time', async () => {
  const [app, rail] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/components/TemporalRail.tsx'),
  ]);

  assert.match(
    app,
    /atmosphere=\{\s*scope === 'city' && temporal\.mode === 'live' \? atmosphere : null\s*\}/u,
  );
  assert.match(app, /environment:[\s\S]{0,180}temporal\.mode === 'live'/u);
  assert.match(app, /liveContext:[\s\S]{0,180}temporal\.mode === 'live'/u);
  assert.match(app, /temporal\.mode !== 'live'[\s\S]{0,120}\? 0/u);
  assert.match(rail, /LIVE SOURCES/u);
  assert.match(rail, /STATIC MAP CONTEXT/u);
  assert.match(rail, /MODELED \+ STATIC/u);
  assert.match(rail, /current weather\/AQI\/seismic hidden/u);
});

test('v4 live 4d clock advances automatically while non-live cursors remain independent', async () => {
  const [clock, rail] = await Promise.all([
    text('apps/aethergrid-console/web/src/time/temporal-clock.ts'),
    text('apps/aethergrid-console/web/src/components/TemporalRail.tsx'),
  ]);

  assert.match(clock, /#liveTimer/u);
  assert.match(clock, /setInterval\(\(\) => \{/u);
  assert.match(clock, /this\.#state\.liveIso = liveIso/u);
  assert.match(clock, /this\.#state\.mode === 'live' && !this\.#state\.playing/u);
  assert.match(clock, /this\.#state\.cursorIso = liveIso/u);
  assert.match(clock, /clearInterval\(this\.#liveTimer\)/u);
  assert.match(rail, /disabled=\{state\.mode === 'live'\}/u);
  assert.match(rail, /Live time advances automatically/u);
});

test('v4 thunderstorm presentation is source-bounded and explicitly synthetic in timing', async () => {
  const [atmosphere, viewport] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/overlays/atmospheric-overlay.ts'),
    text('apps/aethergrid-console/web/src/components/SpatialViewport.tsx'),
  ]);

  assert.match(atmosphere, /weatherPhenomenon\(snapshot\) !== 'thunderstorm'/u);
  assert.match(atmosphere, /precipitationMm/u);
  assert.match(atmosphere, /windGustsKph/u);
  assert.match(atmosphere, /cadenceSeconds/u);
  assert.match(atmosphere, /flashOpacity/u);
  assert.match(viewport, /time\.mode === 'live'/u);
  assert.match(viewport, /stormPresentation\(atmosphere, time\.iso\)/u);
  assert.match(viewport, /SOURCE WEATHER · SYNTHETIC FLASH TIMING/u);
});

test('v4 live wind field is source-backed spatial geometry shared by Cesium and native failover', async () => {
  const [service, cesium, nativeRenderer, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/city-environment.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(service, /atmosphereToWindOverlay/u);
  assert.match(service, /kind: 'flow'/u);
  assert.match(service, /vectorType: 'wind'/u);
  assert.match(service, /meteorologicalFromDegrees/u);
  assert.match(service, /syntheticGeometry: true/u);
  assert.match(service, /layerId: 'weather'/u);
  assert.match(app, /const windOverlay = useMemo/u);
  assert.match(app, /powerOverlay,[\s\S]{0,120}windOverlay,[\s\S]{0,120}seismicOverlay/u);
  assert.match(cesium, /windEdge/u);
  assert.match(cesium, /#7de9ff/u);
  assert.match(nativeRenderer, /windEdge/u);
  assert.match(nativeRenderer, /#7de9ff/u);
});

test('v4 night illumination follows mapped building geometry with explicit presentation-only boundaries', async () => {
  const [service, cesium, nativeRenderer, app] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/city-power-overlay.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
  ]);

  assert.match(service, /cityMeshToIlluminationOverlay/u);
  assert.match(service, /selected\.size >= 500/u);
  assert.match(service, /presentationType: 'urban-illumination'/u);
  assert.match(service, /measuredWindowLights: false/u);
  assert.match(service, /measuredOccupancy: false/u);
  assert.match(app, /citySolar\.phase === 'twilight' \|\| citySolar\.phase === 'night'/u);
  assert.match(app, /PRESENTATION ONLY · NOT MEASURED WINDOW LIGHTS/u);
  assert.match(cesium, /#ffd37d/u);
  assert.match(nativeRenderer, /#ffd37d/u);
});

test('v4 native failover preserves source-driven weather geometry and layer toggles', async () => {
  const nativeRenderer = await text(
    'apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts',
  );

  assert.match(nativeRenderer, /weatherPhenomenon/u);
  assert.match(nativeRenderer, /#weatherGeometry/u);
  assert.match(nativeRenderer, /cloudCoverPercent/u);
  assert.match(nativeRenderer, /precipitationMm/u);
  assert.match(nativeRenderer, /phenomenon === 'snow'/u);
  assert.match(nativeRenderer, /phenomenon === 'fog'/u);
  assert.match(nativeRenderer, /phenomenon === 'thunderstorm'/u);
  assert.match(nativeRenderer, /this\.#layerVisible\('weather', true\)/u);
  assert.match(nativeRenderer, /this\.#layerVisible\('air', true\)/u);
  assert.match(nativeRenderer, /const weather = this\.#weatherGeometry\(\)/u);
  assert.match(nativeRenderer, /gl\.drawArrays/u);
  assert.match(nativeRenderer, /context\.arc/u);
});

test('v4 native failover preserves source-driven AQI particles with wind drift', async () => {
  const nativeRenderer = await text(
    'apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts',
  );

  assert.match(nativeRenderer, /#airGeometry/u);
  assert.match(nativeRenderer, /current\.usAqi/u);
  assert.match(nativeRenderer, /current\.pm25UgM3/u);
  assert.match(nativeRenderer, /current\.category === 'good'/u);
  assert.match(nativeRenderer, /current\.category === 'hazardous'/u);
  assert.match(nativeRenderer, /current\.windDirectionDegrees/u);
  assert.match(nativeRenderer, /current\.windSpeedKph/u);
  assert.match(nativeRenderer, /this\.#layerVisible\('air', true\)/u);
  assert.match(nativeRenderer, /const air = this\.#airGeometry\(\)/u);
});

test('v4 documentation and promotion gates describe only implemented spatial capabilities', async () => {
  const [readme, plan, changelog, viewport, nativeRenderer, clock] = await Promise.all([
    text('apps/aethergrid-console/README.md'),
    text('docs/AETHERGRID_FUNCTIONAL_PLAN.md'),
    text('CHANGELOG.md'),
    text('apps/aethergrid-console/web/src/components/SpatialViewport.tsx'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
    text('apps/aethergrid-console/web/src/time/temporal-clock.ts'),
  ]);

  assert.match(readme, /v4 spatial operator web foundation/u);
  assert.match(readme, /does \*\*not\*\* replace the maintained packaged v3 surface/u);
  assert.match(readme, /real source-backed native WebGL fallback/u);
  assert.match(readme, /current weather, AQI and seismic context are hidden outside LIVE mode/u);
  assert.match(readme, /PRESENTATION|presentation-only/u);

  assert.match(plan, /Batch 18 — v4 spatial operator foundation/u);
  assert.match(plan, /Status: IMPLEMENTED ON DRAFT BRANCH/u);
  assert.match(plan, /v4 remains draft until the maintained package path is explicitly promoted/u);

  assert.match(changelog, /draft v4 typed React\/Cesium spatial operator surface/u);
  assert.match(viewport, /new NativeWebglSpatialRenderer\(\)/u);
  assert.match(nativeRenderer, /implements SpatialRenderer/u);
  assert.match(clock, /#liveTimer/u);
});

test('v4 surface picking is renderer-neutral and labels terrain versus projection precision', async () => {
  const [contract, cesium, nativeRenderer, manager] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/spatial-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/renderer-manager.ts'),
  ]);

  assert.match(contract, /interface SpatialSurfacePoint/u);
  assert.match(contract, /'depth-surface'/u);
  assert.match(contract, /'native-projection'/u);
  assert.match(contract, /pickSurface\(point: SpatialPickPoint\)/u);
  assert.match(cesium, /scene\.pickPosition/u);
  assert.match(cesium, /scene\.globe\.pick/u);
  assert.match(cesium, /camera\.pickEllipsoid/u);
  assert.match(nativeRenderer, /source: 'native-projection'/u);
  assert.match(manager, /return this\.#current\.pickSurface\(point\)/u);
});

test('v4 measurement computes geodesic distance bearing and optional elevation without inventing native height', async () => {
  const analysis = await text('apps/aethergrid-console/web/src/services/spatial-analysis.ts');

  assert.match(analysis, /EARTH_RADIUS_METERS/u);
  assert.match(analysis, /measureSpatialPoints/u);
  assert.match(analysis, /bearingDegrees/u);
  assert.match(analysis, /elevationDeltaMeters/u);
  assert.match(analysis, /slopePercent/u);
  assert.match(analysis, /threeDimensionalDistanceMeters/u);
  assert.match(analysis, /ellipsoid-or-projection/u);
  assert.match(analysis, /layerId: 'analysis'/u);
  assert.match(analysis, /ÆTHERGRID operator geodesic measurement/u);
});

test('v4 analysis workspace captures the 4d frame and routes measure clicks without breaking inspect mode', async () => {
  const [viewport, app, panel] = await Promise.all([
    text('apps/aethergrid-console/web/src/components/SpatialViewport.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/components/SpatialAnalysisPanel.tsx'),
  ]);

  assert.match(viewport, /interactionModeRef\.current === 'measure'/u);
  assert.match(viewport, /\.pickSurface\(screen\)/u);
  assert.match(viewport, /\.pick\(screen\)/u);
  assert.match(app, /measurementFrame/u);
  assert.match(app, /setMeasurementFrame\(\{ \.\.\.temporalInstant \}\)/u);
  assert.match(app, /measurementToOverlay\(measurement, measurementFrame\)/u);
  assert.match(app, /\['context', 'CONTEXT'\],[\s\S]*\['analysis', 'ANALYSIS'\]/u);
  assert.match(panel, /Native fallback cannot claim terrain elevation/u);
  assert.match(panel, /CLEAR MEASUREMENT/u);
});

test('v4 frame comparison captures only temporally valid metrics and leaves missing fields missing', async () => {
  const comparison = await text('apps/aethergrid-console/web/src/services/spatial-comparison.ts');

  assert.match(comparison, /captureSpatialObservation/u);
  assert.match(comparison, /const live = input\.temporal\.mode === 'live'/u);
  assert.match(comparison, /temperatureC: live \?/u);
  assert.match(comparison, /usAqi: live \?/u);
  assert.match(comparison, /seismicEventCount: live \?/u);
  assert.match(comparison, /if \(aValue == null \|\| bValue == null\) return \[\]/u);
  assert.match(comparison, /authoritative: false/u);
  assert.match(comparison, /not a substitute for the server evidence ledger/u);
});

test('v4 analysis workspace compares frame a b and keeps causal interpretation under operator review', async () => {
  const [app, panel] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/components/SpatialComparisonPanel.tsx'),
  ]);

  assert.match(app, /const \[observationA, setObservationA\]/u);
  assert.match(app, /const \[observationB, setObservationB\]/u);
  assert.match(app, /compareSpatialObservations\(observationA, observationB\)/u);
  assert.match(app, /do not infer causation from correlation/u);
  assert.match(app, /agent: 'AUREN'/u);
  assert.match(panel, /FRAME A/u);
  assert.match(panel, /FRAME B/u);
  assert.match(panel, /EXPORT ANALYSIS JSON/u);
  assert.match(panel, /OPERATOR ANALYSIS · NON-AUTHORITATIVE/u);
});

test('v4 spatial analysis promotion boundary keeps local comparison separate from server evidence', async () => {
  const [readme, plan, comparison, panel] = await Promise.all([
    text('apps/aethergrid-console/README.md'),
    text('docs/AETHERGRID_FUNCTIONAL_PLAN.md'),
    text('apps/aethergrid-console/web/src/services/spatial-comparison.ts'),
    text('apps/aethergrid-console/web/src/components/SpatialComparisonPanel.tsx'),
  ]);

  assert.match(readme, /non-authoritative local comparison export/u);
  assert.match(readme, /separate from the server evidence ledger/u);
  assert.match(plan, /local operator-analysis JSON export labeled non-authoritative/u);
  assert.match(plan, /do not establish causal relationships/u);
  assert.match(comparison, /authoritative: false/u);
  assert.match(comparison, /not a substitute for the server evidence ledger/u);
  assert.match(panel, /OPERATOR ANALYSIS · NON-AUTHORITATIVE/u);
});
