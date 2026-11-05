import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('apps/aethergrid-console/legacy-visualizers.js');
const globeCoreSource = await read('apps/aethergrid-console/legacy-globe-core.js');

function renderers(settings = { reducedMotion: true, animationIntensity: 40 }) {
  const frameRequests = [];
  const context = {
    devicePixelRatio: 1,
    performance: { now: () => 0 },
    addEventListener() {},
    requestAnimationFrame(callback) {
      frameRequests.push(callback);
    },
  };
  runInNewContext(globeCoreSource, context, { timeout: 1000 });
  runInNewContext(source, context, { timeout: 1000 });
  const visualizers = context.AETHERGRID_LEGACY_VISUALIZERS({
    clamp: (x, min, max) => Math.max(min, Math.min(max, x)),
    mat4Multiply: () => [],
    perspective: () => [],
    lookAt: () => [],
    isLightTheme: () => false,
    getSettings: () => settings,
  });
  return { visualizers, frameRequests };
}

function canvas2d() {
  let strokes = 0;
  const drawing = {
    setTransform() {},
    clearRect() {},
    save() {},
    translate() {},
    beginPath() {},
    lineTo() {},
    moveTo() {},
    restore() {},
    stroke() {
      strokes++;
    },
  };
  const canvas = {
    clientWidth: 320,
    clientHeight: 180,
    getContext(type) {
      return type === '2d' ? drawing : null;
    },
    getBoundingClientRect() {
      return { width: 320, height: 180 };
    },
  };
  return { canvas, strokes: () => strokes };
}

test('legacy visualizers publish the three named constructors without global operator secrets', () => {
  const { visualizers } = renderers();
  assert.deepEqual(Object.keys(visualizers).sort(), [
    'GlobalGlobe3D',
    'ScenarioChart',
    'WaveSurface',
  ]);
  assert.equal(Object.isFrozen(visualizers), true);
  assert.doesNotMatch(source, /process\.env|API_KEY|api\.tomorrow\.io/u);
});

test('global 3D renderer retains WebGL-unavailable constructor, reset and source city camera targeting', () => {
  const { visualizers } = renderers();
  const canvas = { getContext: () => null };
  const globe = new visualizers.GlobalGlobe3D(canvas);
  assert.equal(globe.gl, null);
  assert.equal(typeof globe.animate, 'function');
  assert.equal(typeof globe.buildGlobe, 'function');
  assert.equal(globe.distance, 11.5);
  globe.distance = 7;
  globe.reset();
  assert.equal(globe.distance, 11.5);
  const target = globe.cityCameraTarget({ lat: 40.7, lon: -74 });
  assert.equal(Number.isFinite(target.yaw), true);
  assert.equal(Number.isFinite(target.pitch), true);
});

test('no-WebGL globe retains repeated city, live and solar configuration without allocating graphics', () => {
  const { visualizers, frameRequests } = renderers();
  const solarUpdates = [];
  const globe = new visualizers.GlobalGlobe3D(
    { getContext: () => null },
    {
      onSolarUpdate: (solar) => solarUpdates.push(solar),
    },
  );
  const cities = [
    { id: 'equator', lat: 0, lon: 0, source: 'source-catalog' },
    { id: 'antipode', lat: 0, lon: 180, source: 'source-catalog' },
  ];
  for (let repeat = 0; repeat < 2; repeat++) {
    globe.setCities(cities);
    assert.deepEqual(
      Array.from(globe.cities, (city) => city.id),
      ['equator', 'antipode'],
    );
    assert.deepEqual(Array.from(globe.cities[0].position), [4.08, 0, 0]);
    assert.equal(globe.cities[1].lat, 0);
    assert.equal(globe.cities[1].lon, 180);
    assert.equal(globe.cities[0].source, 'source-catalog');
    assert.equal(globe.cities[0].solarDaylight, !globe.cities[1].solarDaylight);
    const snapshot = {
      cities: [{ id: 'equator', airQuality: { usAqi: 35 }, source: 'air-observation' }],
      seismic: { events: [{ lat: 1, lon: 2, magnitude: 5.2, source: 'quake-observation' }] },
    };
    globe.setLiveActivity(snapshot);
    assert.equal(globe.liveSnapshot, snapshot);
    assert.equal(globe.cities[0].live, snapshot.cities[0]);
    assert.equal(globe.cities[1].live, null);
    assert.equal(globe.liveBuffers.airGood.count, 1);
    assert.equal(globe.liveBuffers.quakeHigh.count, 1);
    globe.updateSolarGeometry(true);
    globe.updateUtcSweep(true);
    assert.equal(globe.terminatorBuffer.count, 288);
    assert.equal(globe.sunBuffer.count, 1);
    assert.equal(globe.utcSweepBuffer.count, 120);
    assert.equal(Number.isFinite(globe.solarState.subsolarLat), true);
    assert.equal(Number.isNaN(Date.parse(globe.solarState.generatedAt)), false);
    for (const item of [
      globe.cityBuffer,
      globe.terminatorBuffer,
      globe.sunBuffer,
      globe.nightCityBuffer,
      globe.utcSweepBuffer,
      ...Object.values(globe.liveBuffers),
    ]) {
      assert.equal(item.buffer, null);
    }
  }
  assert.equal(solarUpdates.length, 4);
  assert.equal(solarUpdates.at(-1), globe.solarState);
  assert.equal(cities[0].position, undefined);
  globe.setCities([]);
  globe.setLiveActivity(null);
  assert.equal(globe.cities.length, 0);
  assert.equal(globe.cityBuffer.count, 0);
  assert.equal(globe.liveSnapshot, null);
  assert.ok(Object.values(globe.liveBuffers).every((item) => item.count === 0));
  globe.animate();
  globe.resize();
  assert.equal(frameRequests.length, 0);
});

test('no-WebGL globe selection, focus and animated descent preserve callbacks and resolve', async () => {
  const settings = { reducedMotion: false, animationIntensity: 40 };
  const { visualizers, frameRequests } = renderers(settings);
  const selected = [];
  const globe = new visualizers.GlobalGlobe3D(
    { getContext: () => null },
    {
      onSelectCity: (city) => selected.push(city),
    },
  );
  const city = { id: 'east', lat: 0, lon: 90, source: 'source-catalog' };
  for (let repeat = 0; repeat < 2; repeat++) {
    globe.markCitySelected(city);
    assert.equal(globe.selectedCity, city);
    assert.equal(globe.selectedBuffer.buffer, null);
    assert.equal(globe.selectedBuffer.count, 1);
    globe.focusCity(city);
    assert.equal(globe.yaw, -Math.PI);
    assert.equal(globe.pitch, 0);
    assert.equal(globe.distance, 8.2);
    const descent = globe.descendToCity(city, 700);
    assert.equal(typeof descent.then, 'function');
    frameRequests.shift()(350);
    assert.ok(globe.distance > 5.65 && globe.distance < 8.2);
    frameRequests.shift()(700);
    await descent;
    assert.equal(globe.distance, 5.65);
    assert.equal(globe.yaw, -Math.PI);
  }
  settings.reducedMotion = true;
  await globe.descendToCity(city);
  await globe.descendToCity(null);
  assert.equal(selected.length, 7);
  assert.ok(selected.every((value) => value === city));
  assert.equal(frameRequests.length, 0);
  assert.equal(globe.pickCity(0, 0), null);
});

test('two-dimensional wave and scenario canvases render and honor reduced-motion settings', () => {
  const settings = { reducedMotion: true, animationIntensity: 40 };
  const { visualizers, frameRequests } = renderers(settings);
  const waveSurface = canvas2d();
  const scenarioSurface = canvas2d();
  const wave = new visualizers.WaveSurface(waveSurface.canvas);
  const chart = new visualizers.ScenarioChart(scenarioSurface.canvas);
  assert.ok(waveSurface.strokes() >= 15);
  assert.ok(scenarioSurface.strokes() >= 9);
  assert.equal(wave.time, 0);
  assert.equal(chart.phase, 0);
  settings.reducedMotion = false;
  wave.loop();
  chart.loop();
  assert.ok(wave.time > 0);
  assert.ok(chart.phase > 0);
  assert.ok(frameRequests.length >= 4);
});

test('direct-open and packaged legacy pages load visualizers after math and before application', async () => {
  const [html, sw, assembly, app] = await Promise.all([
    read('apps/aethergrid-console/index.html'),
    read('apps/aethergrid-console/sw.js'),
    read('scripts/assemble-aethergrid-full-app.mjs'),
    read('apps/aethergrid-console/app.js'),
  ]);
  const order = [
    'state.js',
    'standalone-geo.js',
    'spatial-math.js',
    'legacy-city-buildings.js',
    'legacy-globe-core.js',
    'legacy-visualizers.js',
    'app.js',
  ];
  const at = order.map((file) => html.indexOf('<script src="./' + file + '" defer></script>'));
  assert.ok(at.every((index) => index > 0));
  assert.ok(at.every((index, i) => i === 0 || index > at[i - 1]));
  assert.match(sw, /legacy-visualizers\.js/u);
  assert.match(assembly, /legacyGlobeCoreJs/u);
  assert.match(assembly, /legacyVisualizersJs/u);
  assert.match(assembly, /legacy\/legacy-visualizers\.js/u);
  assert.match(app, /AETHERGRID_LEGACY_VISUALIZERS/u);
  assert.doesNotMatch(app, /  class GlobalGlobe3D \{/u);
  assert.doesNotMatch(app, /  class WaveSurface \{/u);
  assert.doesNotMatch(app, /  class ScenarioChart \{/u);
});
