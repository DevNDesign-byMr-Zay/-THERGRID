import { expect, test } from '@playwright/test';
import { captureSpatialObservation, compareSpatialObservations } from '../src/services/spatial-comparison';
const iso = '2026-10-12T12:00:00Z';
test('comparison frame restoration owns captured modeled effects instead of the active scenario', async () => {
  const module = await import('../src/services/spatial-comparison');
  expect((module as any).comparisonFrameBookmark).toBeInstanceOf(Function);
  const current: any = { scenarioId: 'model-b', scenarioVisual: { stressFactor: 2 }, layers: [], useCase: null };
  const observation: any = { id: 'capture-a', region: 'NEW YORK', capturedAt: iso, visualMode: 'solid', coordinate: { latitude: 40, longitude: -74 }, temporal: { mode: 'scenario', iso, scenarioId: 'backend-a', scenarioVisual: { stressFactor: 1.1, renewableBias: .2, weatherRisk: .3, storageStress: .4 } } };
  const bookmark = (module as any).comparisonFrameBookmark(current, observation, { latitude: 40, longitude: -74 });
  expect(bookmark.scenarioId).toBe('backend-a');
  expect(bookmark.scenarioVisual).toEqual(observation.temporal.scenarioVisual);
  observation.temporal.scenarioVisual.stressFactor = 9;
  expect(bookmark.scenarioVisual.stressFactor).toBe(1.1);
  expect((module as any).comparisonFrameBookmark(current, { ...observation, temporal: { mode: 'historical', iso } }, bookmark.target).scenarioVisual).toBeNull();
});
async function sceneApi() { const module = await import('../src/services/spatial-scene').catch(() => null); expect(module).not.toBeNull(); return module!; }
function sceneInput(): any { return { target: { latitude: 40, longitude: -74, rangeMeters: 2800, apiKey: 'SENTINEL_SECRET' }, camera: { projection: 'geocentric', latitude: 40.1, longitude: -74.1, heightMeters: 1200, headingDegrees: 45, pitchDegrees: -55, rollDegrees: 0 }, visualMode: 'wireframe', layers: [{ id: 'buildings', visible: true, opacity: .25 }], temporal: { iso, mode: 'forecast', range: { start: iso, end: '2026-10-12T13:00:00Z' } }, selection: { id: 'scene-id', kind: 'building', identity: { canonicalId: 'source:building:4', sourceFeatureId: 'osm:4' }, properties: { token: 'SENTINEL_SECRET' } }, datasets: [{ role: 'weather', state: 'forecast', provider: 'contract', sourceTime: iso, fetchedAt: iso, dataset: 'forecast', attribution: 'Contract' }], scenario: null, profile: { email: 'SENTINEL_SECRET' }, config: { token: 'SENTINEL_SECRET' } }; }

test('scene export whitelists view, camera, selection, opacity and source range without secrets', async () => {
  const { buildSpatialSceneDescription } = await sceneApi();
  const input = sceneInput(), scene = buildSpatialSceneDescription(input);
  expect(scene.schemaVersion).toBe('aethergrid.spatial-scene.v1');
  expect(scene.authoritative).toBe(false);
  expect(scene.camera?.heightMeters).toBe(1200);
  expect(scene.selection?.sourceFeatureId).toBe('osm:4');
  expect(scene.layers[0].opacity).toBe(.25);
  expect(scene.frame.range?.end).toBe('2026-10-12T13:00:00Z');
  expect(JSON.stringify(scene)).not.toContain('SENTINEL_SECRET');
  input.temporal.range.end = iso; input.datasets[0].state = 'live'; input.camera.heightMeters = 10;
  expect(scene.frame.range?.end).toBe('2026-10-12T13:00:00Z');
  expect(scene.sources[0].state).toBe('forecast');
  expect(scene.camera?.heightMeters).toBe(1200);
});

test('unsupported or invalid camera is explicit and never reconstructed from target', async () => {
  const { buildSpatialSceneDescription } = await sceneApi();
  for (const camera of [null, { ...sceneInput().camera, latitude: NaN }]) {
    const scene = buildSpatialSceneDescription({ ...sceneInput(), camera });
    expect(scene.camera).toBeNull(); expect(scene.limitations.join(' ')).toContain('Camera');
  }
});

test('scene preserves operator assumption text and original picked heights without arbitrary fields', async () => {
  const { buildSpatialSceneDescription } = await sceneApi();
  const input = sceneInput();
  input.temporal = { iso, mode: 'scenario', scenarioId: 'model-a' };
  input.scenario = { id: 'model-a', name: 'Contract model', startIso: iso, endIso: iso, parameters: { loadMultiplierPercent: 100, renewableAvailabilityPercent: 100, storageReservePercent: 10, weatherRiskPercent: 20 }, assumptions: [{ id: 'a', text: 'Operator assumption, not an observation', createdAt: iso, token: 'SENTINEL_SECRET' }] };
  input.area = { approximation: 'local-tangent-plane', areaSquareMeters: 10, perimeterMeters: 20, points: [{ latitude: 40, longitude: -74, heightMeters: -11.6, source: 'depth-surface', token: 'SENTINEL_SECRET' }] };
  const scene = buildSpatialSceneDescription(input);
  expect(scene.modeledEffects?.assumptions[0].text).toBe('Operator assumption, not an observation');
  expect(scene.measurement?.points[0].heightMeters).toBe(-11.6);
  expect(JSON.stringify(scene)).not.toContain('SENTINEL_SECRET');
});

test('scene retains declared backend scenario presentation independently of a local operator model', async () => {
  const { buildSpatialSceneDescription } = await sceneApi();
  const input = sceneInput();
  input.temporal = { iso, mode: 'scenario', scenarioId: 'backend-contract', scenarioVisual: { stressFactor: 1.12, renewableBias: .2, storageStress: .3, weatherRisk: .4, token: 'SENTINEL_SECRET' } };
  const scene = buildSpatialSceneDescription(input);
  expect((scene as any).modeledPresentation.stressFactor).toBe(1.12);
  expect(scene.modeledEffects).toBeNull();
  expect(JSON.stringify(scene)).not.toContain('SENTINEL_SECRET');
});

test('analytical and illumination receipts are modeled rather than observation timestamps', async () => {
  const api = await sceneApi();
  expect((api as any).overlaySceneReceipts).toBeInstanceOf(Function);
  const snapshots = ['scenario-model','illumination','analysis','energy'].map(layerId => ({ id: layerId, layerId, eventTime: iso, sourceTime: iso, fetchedAt: iso, live: true, stale: false, fallback: false, nodes: [], edges: [], attribution: 'Contract' }));
  const receipts = (api as any).overlaySceneReceipts(snapshots);
  for (const receipt of receipts.slice(0,3)) { expect(receipt.state).toBe('modeled'); expect(receipt.sourceTime).toBeNull(); }
  expect(receipts[3].state).toBe('mapped');
});

function observation(mode = 'forecast', stale = false, currentTime = iso): any {
  return captureSpatialObservation({ region: 'contract', latitude: 40, longitude: -74, temporal: { mode: mode as any, iso }, visualMode: 'solid', useCase: null, cityIdentity: null, liveContext: null, selection: null, measurement: null,
    atmosphere: { id: 'contract', coordinate: { latitude: 40, longitude: -74 }, eventTime: iso, sourceTime: currentTime, fetchedAt: iso, live: !stale, stale, fallback: false, attribution: 'UTC forecast contract', timezone: 'UTC', utcOffsetSeconds: 0, current: { time: currentTime, temperatureC: 12, windSpeedKph: 18 } as any } });
}

test('comparison captures only exact source-backed forecast weather with distinct receipt state', () => {
  expect(observation().metrics.temperatureC).toBe(12);
  expect(observation().weatherReceipt.state).toBe('forecast');
  expect(observation('forecast',true).weatherReceipt.state).toBe('stale');
  expect(observation('forecast',true).metrics.windSpeedKph).toBe(18);
  expect(observation('forecast',false,'2026-10-12T13:00:00Z').metrics.temperatureC).toBeNull();
  for (const mode of ['historical','scenario']) { expect(observation(mode).metrics.temperatureC).toBeNull(); expect(observation(mode).weatherReceipt.state).toBe('unavailable'); }
});

test('live-to-forecast differences cannot become verified measured change', () => {
  const comparison = compareSpatialObservations(observation('live'),observation());
  const temperature = comparison.metricDeltas.find(metric => metric.key === 'temperatureC')!;
  expect(temperature).toBeDefined();
  expect((temperature as any).basis).toBe('mixed-source-states');
});
