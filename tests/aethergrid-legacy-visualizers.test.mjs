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
