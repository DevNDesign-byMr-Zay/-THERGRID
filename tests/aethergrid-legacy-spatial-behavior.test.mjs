import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';

const appRoot = new URL('../apps/aethergrid-console/', import.meta.url);
const read = (file) => readFile(new URL(file, appRoot), 'utf8');
const appSource = await read('app.js');
const mathSource = await read('spatial-math.js');
const buildingsSource = await read('legacy-city-buildings.js');

function webgl() {
  const buffers = [];
  const deleted = [];
  const draws = [];
  const uniforms = {};
  let activeBuffer;
  const gl = {
    ARRAY_BUFFER: 1,
    STATIC_DRAW: 2,
    FLOAT: 3,
    LINES: 4,
    POINTS: 5,
    TRIANGLES: 6,
    VERTEX_SHADER: 7,
    FRAGMENT_SHADER: 8,
    COMPILE_STATUS: 9,
    DEPTH_TEST: 10,
    LEQUAL: 11,
    BLEND: 12,
    SRC_ALPHA: 13,
    ONE_MINUS_SRC_ALPHA: 14,
    COLOR_BUFFER_BIT: 16,
    DEPTH_BUFFER_BIT: 32,
    createShader: () => ({}),
    createProgram: () => ({}),
    getShaderParameter: () => true,
    getAttribLocation: () => 0,
    getUniformLocation: (_, name) => name,
    createBuffer() {
      const buffer = { id: buffers.length };
      buffers.push(buffer);
      return buffer;
    },
    bindBuffer(_, buffer) {
      activeBuffer = buffer;
    },
    bufferData(_, data) {
      activeBuffer.data = [...data];
    },
    deleteBuffer(buffer) {
      deleted.push(buffer);
    },
    uniform1f(name, value) {
      uniforms[name] = value;
    },
    uniform2f(name, x, z) {
      uniforms[name] = [x, z];
    },
    uniform4fv(name, value) {
      uniforms[name] = [...value];
    },
    uniformMatrix4fv(name, _, value) {
      uniforms[name] = [...value];
    },
    viewport(...value) {
      gl.viewportValue = value;
    },
    clearColor(...value) {
      gl.clearValue = value;
    },
    drawArrays(primitive, _, count) {
      draws.push({ buffer: activeBuffer, primitive, count, uniforms: structuredClone(uniforms) });
    },
  };
  for (const name of [
    'shaderSource',
    'compileShader',
    'attachShader',
    'linkProgram',
    'vertexAttribPointer',
    'enableVertexAttribArray',
    'enable',
    'depthFunc',
    'blendFunc',
    'clear',
    'useProgram',
  ])
    gl[name] = () => {};
  return { gl, buffers, deleted, draws };
}

function harness({ available = true, settings = {}, options = {} } = {}) {
  const gpu = webgl();
  const events = {};
  const frames = [];
  const windowEvents = {};
  const readout = { textContent: '' };
  const preferences = { reducedMotion: false, animationIntensity: 60, ...settings };
  const canvas = {
    width: 0,
    height: 0,
    classList: { add() {}, remove() {} },
    getContext: () => (available ? gpu.gl : null),
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 320, height: 180 }),
    addEventListener(name, callback) {
      events[name] = callback;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
  };
  const context = {
    performance: { now: () => 100 },
    devicePixelRatio: 3,
    q: () => readout,
    state: { settings: preferences },
    isLightTheme: () => false,
    environmentHour: (environment) => environment?.current?.hour ?? null,
    titleCase: (value) => value.replaceAll('-', ' '),
    addEventListener(name, callback) {
      windowEvents[name] = callback;
    },
    requestAnimationFrame(callback) {
      frames.push(callback);
    },
  };
  runInNewContext(mathSource, context);
  runInNewContext(buildingsSource, context);
  Object.assign(context, context.AETHERGRID_SPATIAL_MATH);
  const start = appSource.indexOf('  class SpatialGrid4D {');
  const end = appSource.indexOf('\n  const { GlobalGlobe3D, WaveSurface, ScenarioChart }', start);
  runInNewContext(
    `${appSource.slice(start, end)}\nglobalThis.SpatialGrid4D = SpatialGrid4D;`,
    context,
  );
  const renderer = new context.SpatialGrid4D(canvas, { readoutId: 'camera', ...options });
  return { renderer, canvas, events, frames, windowEvents, readout, preferences, ...gpu };
}

function cityMesh(overrides = {}) {
  return {
    city: { radiusM: 1000 },
    buildings: Array.from({ length: 6 }, (_, index) => ({
      id: `building-${index}`,
      name: index === 0 ? 'Source Tower' : '',
      footprint: [
        [index * 30, 0],
        [index * 30 + 20, 0],
        [index * 30 + 20, 20],
        [index * 30, 20],
        [index * 30, 0],
      ],
      heightM: 100 - index * 10,
      minHeightM: index === 0 ? 10 : 0,
      heightSource: 'osm-height',
      roofHeightM: 15,
      roofShape: 'pyramidal',
      buildingMaterial: ['glass', 'brick', 'steel', 'wood', '', ''][index],
    })),
    roads: [
      {
        path: [
          [0, 0],
          [100, 100],
        ],
      },
    ],
    waterAreas: [
      {
        footprint: [
          [-200, -200],
          [-100, -200],
          [-100, -100],
          [-200, -200],
        ],
      },
    ],
    greenAreas: [
      {
        footprint: [
          [100, 100],
          [200, 100],
          [200, 200],
          [100, 100],
        ],
      },
    ],
    waterways: [
      {
        path: [
          [-100, 0],
          [100, 0],
        ],
      },
    ],
    coastlines: [
      {
        path: [
          [-400, -300],
          [400, -300],
        ],
      },
    ],
    powerLines: [
      {
        path: [
          [0, 0],
          [200, 100],
        ],
        voltage: 138000,
      },
    ],
    powerAssets: [{ id: 'power', powerType: 'substation', position: [20, 30], voltage: 138000 }],
    terrain: {
      gridSize: 2,
      radiusM: 1000,
      source: { live: true, provider: 'verified-source' },
      points: [
        [-1000, -1000, 0],
        [1000, -1000, 10],
        [-1000, 1000, 20],
        [1000, 1000, 30],
      ].map(([x, z, relativeElevationM]) => ({ x, z, relativeElevationM })),
    },
    skylineProfile: { maxHeightM: 100, p95HeightM: 90, buildingCount: 6 },
    environment: {
      current: {
        cloudCoverPercent: 50,
        windSpeedKph: 20,
        windDirectionDegrees: 90,
        precipitationMm: 2,
        weatherCode: 95,
        visibilityM: 3000,
        isDay: false,
        hour: 12,
      },
    },
    liveContext: {
      airQuality: { current: { usAqi: 100 } },
      seismic: { events: [{ magnitude: 4, offsetM: { x: 12000, z: 0 } }] },
    },
    ...overrides,
  };
}

function geometryDigest(renderer) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(renderer.geometry).map(([key, item]) => [key, item.buffer.data]),
        ),
      ),
    )
    .digest('hex');
}

const counts = (renderer) =>
  Object.fromEntries(Object.entries(renderer.geometry).map(([key, item]) => [key, item.count]));
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} should equal ${expected}`);

test('legacy spatial constructor initializes buffers, viewport and stable frame callback', () => {
  const { renderer, canvas, gl, frames, events, windowEvents } = harness();
  assert.equal(renderer.graphNodes.length, 7);
  assert.equal(renderer.geometry.grid.count, 84);
  assert.equal(renderer.geometry.buildings.count, 1728);
  assert.equal(renderer.geometry.routes.count, 396);
  assert.equal(renderer.geometry.nodes.count, 7);
  assert.equal(Object.keys(renderer.geometry).length, 30);
  assert.deepEqual(renderer.geometry.grid.buffer.data.slice(0, 8), [
    -10,
    0,
    -10,
    Math.fround(-2.1),
    10,
    0,
    -10,
    Math.fround(-1.8),
  ]);
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 360);
  assert.deepEqual(gl.viewportValue, [0, 0, 640, 360]);
  assert.equal(frames.length, 1);
  assert.equal(frames[0], renderer.animate);
  assert.equal(typeof windowEvents.resize, 'function');
  assert.equal(Object.keys(events).length, 6);
  assert.ok([...renderer.currentMvp].every(Number.isFinite));
});

test('legacy spatial unavailable WebGL leaves controller state without binding or scheduling', () => {
  const { renderer, frames, events, buffers } = harness({ available: false });
  assert.equal(renderer.gl, null);
  assert.equal(renderer.yaw, 0.74);
  assert.equal(renderer.distance, 20);
  assert.equal(typeof renderer.animate, 'function');
  assert.equal(frames.length, 0);
  assert.equal(buffers.length, 0);
  assert.equal(Object.keys(events).length, 0);
  renderer.loadCityMesh(cityMesh());
  renderer.loadGraph({ nodes: [], routes: [] });
  assert.equal(Object.keys(renderer.geometry).length, 0);
});

test('legacy graph replacement deletes prior GPU buffers and selection, preserves input and drops bad routes', () => {
  const { renderer, deleted } = harness();
  const previous = Object.values(renderer.geometry).map((item) => item.buffer);
  renderer.selectNode(renderer.graphNodes[0]);
  const selection = renderer.selectionBuffer.buffer;
  const graph = {
    nodes: [
      { id: 'a', position: [-1, 2, 0] },
      { id: 'b', position: [1, 2, 0] },
    ],
    routes: [
      { from: 'a', to: 'b', phase: 1 },
      { from: 'missing', to: 'b' },
    ],
    structures: [{ x: 0, z: 0, width: 1, depth: 1, height: 3 }],
  };
  renderer.environment = {};
  renderer.operationProfile = 'weather';
  renderer.loadGraph(graph);
  assert.ok([...previous, selection].every((buffer) => deleted.includes(buffer)));
  assert.equal(deleted.length, 31);
  assert.equal(renderer.selectedNode, null);
  assert.equal(renderer.selectionBuffer, null);
  assert.equal(renderer.environment, null);
  assert.equal(renderer.operationProfile, null);
  assert.equal(renderer.geometry.routes.count, 44);
  assert.equal(renderer.geometry.buildings.count, 24);
  assert.deepEqual(renderer.geometry.nodes.buffer.data, [-1, 2, 0, 0, 1, 2, 0, Math.fround(0.91)]);
  renderer.graphNodes[0].position[0] = 99;
  assert.equal(graph.nodes[0].position[0], -1);
  const beforeInvalid = renderer.geometry;
  renderer.loadGraph({ nodes: [], routes: [] });
  assert.equal(renderer.geometry, beforeInvalid);
});

test('legacy city meshes conform source buildings, surfaces, landmarks and infrastructure to terrain', () => {
  const { renderer, deleted } = harness();
  const mesh = cityMesh();
  renderer.selectNode(renderer.graphNodes[0]);
  renderer.loadCityMesh(mesh);
  assert.equal(deleted.length, 31);
  const result = counts(renderer);
  assert.equal(result.buildings, 144);
  assert.equal(result.buildingFaces, 144);
  assert.equal(result.roofFaces, 72);
  assert.equal(result.roofLines, 48);
  assert.equal(result.materialGlassFaces, 24);
  assert.equal(result.materialMasonryFaces, 24);
  assert.equal(result.materialMetalFaces, 24);
  assert.equal(result.materialNaturalFaces, 24);
  assert.equal(result.waterFaces, 9);
  assert.equal(result.waterLines, 10);
  assert.equal(result.greenFaces, 9);
  assert.equal(result.terrain, 8);
  assert.equal(result.infrastructureNodes, 1);
  assert.equal(result.landmarkNodes, 2);
  assert.equal(result.clouds, 45);
  assert.equal(result.weather, 140);
  assert.equal(result.precipitation, 176);
  assert.equal(result.storm, 42);
  assert.equal(result.fog, 119);
  assert.equal(result.air, 52);
  assert.equal(result.seismicLines, 168);
  assert.equal(result.seismicNodes, 1);
  near(renderer.geometry.buildings.buffer.data[1], 0.23747875);
  assert.equal(renderer.terrainConformance.active, true);
  assert.equal(renderer.terrainConformance.source, 'verified-source');
  assert.equal(renderer.environment, mesh.environment);
  assert.equal(renderer.liveContext, mesh.liveContext);
  assert.equal(renderer.landmarkNodes[0].label, 'Source Tower');
  assert.ok(
    renderer.graphNodes.some((node) => node.id === 'power' && node.type === 'power-substation'),
  );
  near(renderer.yaw, 0.76);
  near(renderer.pitch, 0.52125);
  near(renderer.distance, 17.612);
  assert.equal(renderer.selectionBuffer, null);
  assert.equal(
    geometryDigest(renderer),
    '65dce17751022ba5b332ae7d9307ecb72a5f61a804cfc7332f2c017145b07b7f',
  );
});

test('legacy environment geometry retains snow/fog classification and absent-source emptiness', () => {
  const { renderer } = harness();
  renderer.loadCityMesh(
    cityMesh({
      environment: { current: { weatherCode: 73, precipitationMm: 2, visibilityM: 2000 } },
      liveContext: null,
    }),
  );
  assert.equal(renderer.geometry.snow.count, 86);
  assert.equal(renderer.geometry.precipitation.count, 0);
  assert.equal(renderer.geometry.storm.count, 0);
  assert.equal(renderer.geometry.fog.count, 133);
  assert.equal(renderer.geometry.air.count, 0);
  renderer.loadCityMesh(cityMesh({ environment: null, liveContext: null }));
  for (const layer of [
    'clouds',
    'weather',
    'precipitation',
    'snow',
    'fog',
    'storm',
    'air',
    'seismicLines',
  ]) {
    assert.equal(renderer.geometry[layer].count, 0, layer);
  }
});

test('legacy pointer and wheel controls preserve drag thresholds, selection and camera bounds', () => {
  let selected;
  const { renderer, events, readout } = harness({
    options: {
      onSelectNode: (node) => {
        selected = node;
      },
    },
  });
  renderer.currentMvp = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  renderer.graphNodes = [{ id: 'center', position: [0, 0, 0] }];
  events.pointerdown({ clientX: 170, clientY: 110, pointerId: 1 });
  events.pointerup({ clientX: 170, clientY: 110, pointerId: 1 });
  assert.equal(selected.id, 'center');
  events.pointerdown({ clientX: 0, clientY: 0, pointerId: 1 });
  events.pointermove({ clientX: 100, clientY: 1000 });
  near(renderer.yaw, 1.54);
  assert.equal(renderer.pitch, 1.15);
  events.pointercancel({ pointerId: 1 });
  assert.equal(renderer.drag, null);
  let prevented = false;
  events.wheel({
    deltaY: 100000,
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(renderer.distance, 34);
  events.wheel({ deltaY: -100000, preventDefault() {} });
  assert.equal(renderer.distance, 10);
  renderer.setProjection('orthographic');
  assert.equal(renderer.projectionMode, 'orthographic');
  assert.equal(renderer.pitch, 1.08);
  renderer.setProjection('isometric');
  assert.equal(renderer.projectionMode, 'perspective');
  assert.equal(renderer.yaw, 0.78);
  events.dblclick();
  assert.equal(renderer.yaw, 0.74);
  assert.match(readout.textContent, /20.0m$/u);
});

test('legacy frame drawing preserves temporal uniforms, compare pass and reduced-motion behavior', async () => {
  const { renderer, draws, gl, preferences, frames } = harness();
  renderer.loadCityMesh(cityMesh());
  renderer.autoRotate = true;
  renderer.setCompare(true, 18);
  renderer.setTemporalMode('trail');
  renderer.setIntensity(0.5);
  const before = renderer.yaw;
  draws.length = 0;
  renderer.animate(1100);
  near(renderer.yaw - before, 0.00042);
  assert.deepEqual(gl.clearValue, [0.004, 0.015, 0.04, 1]);
  const rain = draws.find((draw) => draw.buffer === renderer.geometry.precipitation.buffer);
  assert.ok(rain.uniforms.u_drop > 0);
  near(rain.uniforms.u_flow[0], 0.22);
  const routeDraws = draws.filter((draw) => draw.buffer === renderer.geometry.routes.buffer);
  assert.equal(routeDraws.length, 2);
  assert.notEqual(routeDraws[0].uniforms.u_time, routeDraws[1].uniforms.u_time);
  preferences.reducedMotion = true;
  draws.length = 0;
  const frozenYaw = renderer.yaw;
  renderer.animate(2100);
  assert.equal(renderer.yaw, frozenYaw);
  assert.ok(draws.every((draw) => draw.uniforms.u_amp === 0));
  Object.assign(renderer, { yaw: 0, pitch: 0, distance: 0 });
  const priorFrames = frames.length;
  await renderer.cinematicEntrance();
  near(renderer.yaw, renderer.cityCameraTarget.yaw);
  assert.equal(frames.length, priorFrames);
});

test('legacy cinematic entrance interpolates once per frame and resolves at target', async () => {
  const { renderer, frames } = harness();
  frames.length = 0;
  const done = renderer.cinematicEntrance(1000);
  assert.equal(renderer.distance, 32);
  frames.shift()(600);
  near(renderer.distance, 19.75);
  frames.shift()(1100);
  await done;
  assert.equal(renderer.distance, 18);
  assert.equal(renderer.pitch, 0.57);
  assert.equal(frames.length, 0);
});
