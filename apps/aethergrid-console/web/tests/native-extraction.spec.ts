import { expect, test } from '@playwright/test';
import { NativeWebglSpatialRenderer } from '../src/renderer/native/native-webgl-renderer';
import type { SpatialOverlaySnapshot } from '../src/renderer/overlays/spatial-overlay';

type Draw = { mode: number; positions: number[]; colors: number[]; sizes: number[] };

function nativeFixture(webgl = false) {
  const names = [
    'document',
    'window',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'devicePixelRatio',
  ];
  const previous = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const globals = globalThis as any;
  const arcs: number[][] = [],
    segments: number[][] = [],
    fills: string[] = [],
    draws: Draw[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let reducedMotion = true,
    removed = false,
    nextFrame = 0,
    deletedBuffers = 0;
  const context = new Proxy(
    {
      fillStyle: '',
      arc: (...v: number[]) => arcs.push(v),
      moveTo: (...v: number[]) => segments.push(v),
      lineTo: (...v: number[]) => segments.push(v),
      fill() {
        fills.push(this.fillStyle);
      },
    },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}) },
  );
  let uploads: number[][] = [];
  const gl = new Proxy(
    {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      LINK_STATUS: 3,
      COMPILE_STATUS: 4,
      ARRAY_BUFFER: 5,
      DYNAMIC_DRAW: 6,
      FLOAT: 7,
      LINES: 8,
      POINTS: 9,
      BLEND: 10,
      SRC_ALPHA: 11,
      ONE_MINUS_SRC_ALPHA: 12,
      COLOR_BUFFER_BIT: 13,
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => ({}),
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getAttribLocation: (_p: unknown, name: string) =>
        ['a_position', 'a_color', 'a_pointSize'].indexOf(name),
      bufferData: (_target: number, values: Float32Array) => uploads.push(Array.from(values)),
      drawArrays(mode: number, _start: number, count: number) {
        const [positions, colors, sizes] = uploads;
        expect(positions.length).toBe(count * 2);
        expect(colors.length).toBe(count * 4);
        expect(sizes.length).toBe(count);
        draws.push({ mode, positions, colors, sizes });
        uploads = [];
      },
      deleteBuffer() {
        deletedBuffers += 1;
      },
    },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}) },
  );
  const canvas: any = {
    style: {},
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    setAttribute() {},
    remove() {
      removed = true;
    },
    getContext: (kind: string) => (kind === 'webgl' && webgl ? gl : kind === '2d' ? context : null),
  };
  globals.document = { createElement: () => canvas };
  globals.window = { matchMedia: () => ({ matches: reducedMotion }) };
  globals.devicePixelRatio = 3;
  globals.requestAnimationFrame = (callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  };
  globals.cancelAnimationFrame = (id: number) => frames.delete(id);
  const renderer = new NativeWebglSpatialRenderer();
  renderer.mount({ clientWidth: 800, clientHeight: 600, replaceChildren() {} } as any);
  return {
    renderer,
    canvas,
    arcs,
    segments,
    fills,
    draws,
    get removed() {
      return removed;
    },
    get pendingFrames() {
      return frames.size;
    },
    get deletedBuffers() {
      return deletedBuffers;
    },
    set reducedMotion(value: boolean) {
      reducedMotion = value;
    },
    frame(now: number) {
      const [id, callback] = frames.entries().next().value!;
      frames.delete(id);
      callback(now);
    },
    reset() {
      arcs.length = 0;
      segments.length = 0;
      fills.length = 0;
      draws.length = 0;
    },
    restore() {
      renderer.destroy();
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globals[name];
      }
    },
  };
}

function sourceOverlay(): SpatialOverlaySnapshot {
  return {
    id: 'source-fixture',
    layerId: 'energy',
    eventTime: '2026-10-13T12:00:00Z',
    sourceTime: '2026-10-13T11:59:00Z',
    fetchedAt: '2026-10-13T12:00:01Z',
    live: true,
    stale: false,
    fallback: false,
    attribution: 'Source network',
    nodes: [
      {
        id: 'station',
        kind: 'substation',
        position: { latitude: 45, longitude: 90, heightMeters: 12 },
        intensity: 0.5,
        properties: { sourceFeatureId: 'mapped-station', voltage: 110 },
      },
    ],
    edges: [
      {
        id: 'line',
        kind: 'transmission',
        from: { latitude: 0, longitude: -90 },
        to: { latitude: 0, longitude: 90 },
        properties: { sourceFeatureId: 'mapped-line' },
      },
    ],
    areas: [],
  };
}

test('native drawing keeps projected source geometry, opacity, selection and pick provenance', async () => {
  for (const webgl of [false, true]) {
    const fixture = nativeFixture(webgl),
      { renderer } = fixture;
    try {
      await renderer.initialize();
      renderer.setLayers([
        { id: 'grid', visible: false },
        { id: 'energy', visible: true, opacity: 0.25 },
      ]);
      fixture.reset();
      renderer.applyOverlay(sourceOverlay());
      if (webgl) {
        expect(fixture.draws[0].positions).toEqual([-0.5, 0, 0.5, 0]);
        expect(fixture.draws[0].colors[3]).toBeCloseTo(0.225);
        expect(fixture.draws[1].positions).toEqual([0.5, 0.5]);
        expect(fixture.draws[1].sizes).toEqual([9]);
        expect(fixture.deletedBuffers).toBeGreaterThan(0);
      } else {
        expect(fixture.arcs).toEqual([[450, 112.5, 4.75, 0, Math.PI * 2]]);
        expect(fixture.segments).toEqual([
          [150, 225],
          [450, 225],
        ]);
      }
      expect(await renderer.pick({ x: 600, y: 150 })).toMatchObject({
        id: 'station',
        source: 'Source network',
        latitude: 45,
        longitude: 90,
        heightMeters: 12,
        properties: {
          layerId: 'energy',
          live: true,
          stale: false,
          fallback: false,
          sourceFeatureId: 'mapped-station',
          voltage: 110,
          eventTime: '2026-10-13T12:00:00Z',
          sourceTime: '2026-10-13T11:59:00Z',
        },
      });
      expect(await renderer.pick({ x: 400, y: 300 })).toMatchObject({
        id: 'line',
        latitude: 0,
        longitude: 0,
        properties: { sourceFeatureId: 'mapped-line', attribution: 'Source network' },
      });
      fixture.reset();
      renderer.selectFeature('station');
      if (webgl) expect(fixture.draws[1]).toMatchObject({ colors: [1, 1, 1, 0.25], sizes: [13] });
      else expect(fixture.fills.at(-1)).toBe('#ffffff');
      renderer.setLayers([
        { id: 'grid', visible: false },
        { id: 'energy', visible: false },
      ]);
      expect(await renderer.pick({ x: 600, y: 150 })).toBeNull();
      expect(await renderer.pick({ x: 400, y: 300 })).toBeNull();
    } finally {
      fixture.restore();
    }
  }
});

test('native environmental particles respect temporal modes, layer visibility, tiers and reduced motion', async () => {
  const fixture = nativeFixture(),
    { renderer } = fixture;
  try {
    await renderer.initialize();
    renderer.setLayers([{ id: 'grid', visible: false }]);
    renderer.applyAtmosphere({
      current: {
        weatherCode: 61,
        precipitationMm: 2,
        cloudCoverPercent: 50,
        windSpeedKph: 15,
        windDirectionDegrees: 90,
      },
    } as any);
    renderer.applyAirQuality({
      current: {
        usAqi: 110,
        pm25UgM3: 40,
        category: 'moderate',
        windSpeedKph: 15,
        windDirectionDegrees: 90,
      },
    } as any);
    fixture.reset();
    renderer.setTime({ mode: 'live', iso: '2026-10-13T12:00:00Z' });
    expect(fixture.arcs).toHaveLength(73);
    expect(fixture.segments).toHaveLength(58);
    const fixed = fixture.arcs.map((point) => [...point]);
    fixture.reset();
    renderer.setTime({ mode: 'live', iso: '2026-10-13T12:01:00Z' });
    expect(fixture.arcs).toEqual(fixed);
    fixture.reducedMotion = false;
    fixture.reset();
    renderer.setTime({ mode: 'live', iso: '2026-10-13T12:02:00Z' });
    expect(fixture.arcs).not.toEqual(fixed);
    fixture.reset();
    renderer.setTime({ mode: 'forecast', iso: '2026-10-13T12:00:00Z' });
    expect(fixture.arcs).toHaveLength(26);
    expect(fixture.segments).toHaveLength(58);
    fixture.reset();
    renderer.setTime({ mode: 'historical', iso: '2026-10-13T12:00:00Z' });
    expect(fixture.arcs).toHaveLength(0);
    expect(fixture.segments).toHaveLength(0);
    renderer.clearAirQuality();
    renderer.applyAtmosphere({
      current: {
        weatherCode: 73,
        precipitationMm: 0,
        cloudCoverPercent: 0,
        windSpeedKph: 0,
        visibilityM: 500,
      },
    } as any);
    fixture.reset();
    renderer.setTime({ mode: 'forecast', iso: 'invalid' });
    expect(fixture.arcs).toHaveLength(14);
    expect(fixture.arcs[0][0]).toBeCloseTo(265.700765591464);
    expect(fixture.arcs[0][1]).toBeCloseTo(65.6102983927894);
    renderer.applyAtmosphere({
      current: {
        weatherCode: 61,
        precipitationMm: 2,
        cloudCoverPercent: 50,
        windSpeedKph: 15,
        windDirectionDegrees: 90,
      },
    } as any);
    renderer.applyAirQuality({
      current: {
        usAqi: 110,
        pm25UgM3: 40,
        category: 'moderate',
        windSpeedKph: 15,
        windDirectionDegrees: 90,
      },
    } as any);
    renderer.setTime({ mode: 'live', iso: '2026-10-13T12:00:00Z' });
    fixture.reset();
    renderer.setPerformanceTier('efficiency');
    expect(fixture.arcs).toHaveLength(42);
    expect(fixture.segments).toHaveLength(34);
    renderer.setLayers([
      { id: 'grid', visible: false },
      { id: 'air', visible: false },
      { id: 'weather', visible: false },
    ]);
    fixture.reset();
    renderer.resize();
    expect(fixture.arcs).toHaveLength(0);
    expect(fixture.segments).toHaveLength(0);
  } finally {
    fixture.restore();
  }
});

test('native camera retains projection, journey cancellation, reduced motion and cleanup contracts', async () => {
  const fixture = nativeFixture(),
    { renderer } = fixture;
  try {
    expect(renderer.cameraSnapshot()).toBeNull();
    await renderer.initialize();
    expect(renderer.status()).toMatchObject({
      ready: true,
      degraded: true,
      visualMode: 'holographic',
    });
    expect([fixture.canvas.width, fixture.canvas.height]).toEqual([1200, 900]);
    renderer.setPerformanceTier('quality');
    expect([fixture.canvas.width, fixture.canvas.height]).toEqual([1600, 1200]);
    renderer.setVisualMode('reality');
    expect(renderer.status().visualMode).toBe('solid');
    await renderer.flyTo({
      latitude: 40,
      longitude: -74,
      rangeMeters: 5000,
      headingDegrees: 90,
      pitchDegrees: -45,
      journey: 'direct',
    });
    expect(fixture.pendingFrames).toBe(0);
    expect(renderer.cameraSnapshot()).toMatchObject({
      projection: 'local-projected',
      latitude: 40,
      longitude: -74,
      headingDegrees: 90,
      pitchDegrees: -45,
    });
    expect(await renderer.pickSurface({ x: 400, y: 300 })).toEqual({
      latitude: 40,
      longitude: -74,
      heightMeters: null,
      source: 'native-projection',
    });
    const offset = await renderer.pickSurface({ x: 800, y: 300 });
    expect(offset?.latitude).toBeCloseTo(39.9583861);
    expect(offset?.longitude).toBeCloseTo(-74);
    fixture.reducedMotion = false;
    const started = performance.now();
    const journey = renderer.flyTo({
      latitude: 20,
      longitude: 170,
      rangeMeters: 1000,
      journey: 'full',
    });
    fixture.frame(started + 250);
    expect(renderer.status()).toMatchObject({
      busy: true,
      journeyPhase: 'regional',
      detailLevel: 'regional',
    });
    const replacement = renderer.flyTo({
      latitude: 0,
      longitude: -170,
      rangeMeters: 11800000,
      journey: 'global',
    });
    await journey;
    expect(fixture.pendingFrames).toBe(1);
    fixture.frame(performance.now() + 600);
    await replacement;
    expect(renderer.status()).toMatchObject({
      busy: false,
      journeyPhase: 'idle',
      detailLevel: 'world',
    });
    expect(await renderer.pickSurface({ x: 800, y: 0 })).toMatchObject({
      latitude: 90,
      longitude: 10,
    });
    const unfinished = renderer.flyTo({ latitude: 0, longitude: 0, journey: 'direct' });
    renderer.destroy();
    await unfinished;
    expect(fixture.pendingFrames).toBe(0);
    expect(fixture.removed).toBe(true);
    expect(renderer.status().ready).toBe(false);
    expect(renderer.cameraSnapshot()).toBeNull();
    expect(await renderer.pick({ x: 0, y: 0 })).toBeNull();
    expect(await renderer.pickSurface({ x: 0, y: 0 })).toBeNull();
  } finally {
    fixture.restore();
  }
});
