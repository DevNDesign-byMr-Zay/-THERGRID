import { expect, test } from '@playwright/test';

function scene(overrides: Record<string, unknown> = {}): any {
  return {
    target: { latitude: 0, longitude: 0, rangeMeters: 11800000, journey: 'global' },
    time: { mode: 'live', iso: '2026-06-21T12:00:00Z' },
    mode: 'solid',
    performanceTier: 'balanced',
    layers: new Map([['grid', { id: 'grid', visible: false }]]),
    overlays: new Map(),
    atmosphere: null,
    airQuality: null,
    selectedSourceFeatureId: null,
    selectedLayerId: null,
    ...overrides,
  };
}

// Missing building roof/wall segments or lost source provenance would break this test.
test('native geometry boundary extrudes buildings and preserves source identity across selection', async () => {
  const geometry = await import('../src/renderer/native/native-geometry').catch(() => null);
  expect(geometry).not.toBeNull();
  const frame = scene({
    overlays: new Map([
      [
        'buildings',
        {
          layerId: 'buildings',
          attribution: 'Mapped source',
          eventTime: '2026-06-21T12:00:00Z',
          live: false,
          stale: true,
          fallback: true,
          nodes: [
            {
              id: 'part-a',
              kind: 'asset',
              position: { latitude: 0, longitude: 0 },
              properties: { sourceFeatureId: 'building-a' },
            },
          ],
          edges: [],
          areas: [
            {
              id: 'body',
              kind: 'building',
              positions: [
                { latitude: 0, longitude: 0 },
                { latitude: 0, longitude: 1 },
                { latitude: 1, longitude: 1 },
                { latitude: 0, longitude: 0 },
              ],
              properties: { heightMeters: 20, sourceFeatureId: 'building-a' },
            },
          ],
        },
      ],
    ]),
    selectedSourceFeatureId: 'building-a',
    selectedLayerId: 'buildings',
  });
  const result = geometry!.collectNativeGeometry(frame);
  expect(result.linePositions.length).toBe(36); // Three base, three roof and three vertical segments.
  expect(result.pointColors).toEqual([1, 1, 1, 1]);
  expect(result.pointSizes).toEqual([13]);
  expect(result.features).toMatchObject([
    {
      id: 'part-a',
      source: 'Mapped source',
      properties: {
        layerId: 'buildings',
        sourceFeatureId: 'building-a',
        live: false,
        stale: true,
        fallback: true,
      },
    },
  ]);
  frame.layers.set('buildings', { id: 'buildings', visible: true, opacity: 0 });
  expect(geometry!.collectNativeGeometry(frame).features).toEqual([]);
});

// Losing scenario comparison or alert precedence would silently misrepresent emitted overlays.
test('native geometry boundary preserves scenario comparison and alert coloring', async () => {
  const geometry = await import('../src/renderer/native/native-geometry').catch(() => null);
  expect(geometry).not.toBeNull();
  const frame = scene({
    time: {
      mode: 'scenario',
      iso: '2026-06-21T12:00:00Z',
      scenarioVisual: { renewableBias: 1, weatherRisk: 0, storageStress: 0 },
    },
    overlays: new Map([
      [
        'energy',
        {
          layerId: 'energy',
          nodes: [],
          areas: [],
          edges: [
            {
              id: 'line',
              kind: 'transmission',
              from: { latitude: 0, longitude: -90 },
              to: { latitude: 0, longitude: 90 },
            },
          ],
        },
      ],
    ]),
  });
  const scenario = geometry!.collectNativeGeometry(frame);
  expect(scenario.linePositions).toEqual([-0.5, 0, 0.5, 0, -0.5, 0, 0.5, 0]);
  expect(scenario.lineColors.slice(0, 4)).toEqual([145 / 255, 160 / 255, 173 / 255, 0.22]);
  expect(scenario.lineColors.slice(8, 12)).toEqual([99 / 255, 1, 197 / 255, 0.96]);
  frame.overlays.get('energy').edges[0].properties = {
    eventType: 'nws-alert-boundary',
    severity: 'extreme',
  };
  const alert = geometry!.collectNativeGeometry(frame);
  expect(alert.linePositions).toHaveLength(4);
  expect(alert.lineColors.slice(0, 4)).toEqual([1, 59 / 255, 82 / 255, 0.88]);
});

// Forecast presentation must use weather codes even when the source has no measured precipitation.
test('native environment boundary distinguishes forecast snow, live dry weather, fog and unavailable history', async () => {
  const environment = await import('../src/renderer/native/native-environment').catch(() => null);
  expect(environment).not.toBeNull();
  const frame = scene({
    time: { mode: 'forecast', iso: 'invalid' },
    atmosphere: {
      current: {
        weatherCode: 73,
        precipitationMm: 0,
        cloudCoverPercent: 0,
        windSpeedKph: 0,
        visibilityM: 500,
      },
    },
  });
  const snow = environment!.nativeWeatherGeometry(frame);
  expect(snow.lines).toHaveLength(0);
  expect(snow.points).toHaveLength(14);
  expect(snow.points[0].position).toEqual([-0.11433078136178665, 0.7083986738098247]);
  frame.time.mode = 'live';
  expect(environment!.nativeWeatherGeometry(frame).points).toHaveLength(0);
  frame.atmosphere.current.weatherCode = 45;
  expect(environment!.nativeWeatherGeometry(frame).points).toHaveLength(54);
  frame.time.mode = 'historical';
  expect(environment!.nativeWeatherGeometry(frame)).toEqual({ lines: [], points: [] });
});

// Air haze is live-only and cloud shading accepts forecast; source gaps must not invent particles.
test('native environment boundary preserves air and cloud background eligibility', async () => {
  const environment = await import('../src/renderer/native/native-environment').catch(() => null);
  expect(environment).not.toBeNull();
  const frame = scene();
  expect(environment!.nativeBackground(frame)).toEqual({
    r: 7 / 255,
    g: 17 / 255,
    b: 29 / 255,
    a: 1,
  });
  expect(environment!.nativeAirGeometry(frame)).toEqual({ lines: [], points: [] });
  frame.airQuality = { current: { usAqi: 300, pm25UgM3: 0, category: 'hazardous' } };
  const hazy = environment!.nativeBackground(frame);
  expect(hazy.r).toBeCloseTo(0.20031372549);
  expect(hazy.g).toBeCloseTo(0.21419607843);
  frame.time.mode = 'forecast';
  expect(environment!.nativeAirGeometry(frame).points).toHaveLength(0);
  expect(environment!.nativeBackground(frame).r).toBe(7 / 255);
  frame.atmosphere = { current: { cloudCoverPercent: 90 } };
  expect(environment!.nativeBackground(frame).r).toBeCloseTo(0.04933333333);
  frame.layers.set('weather', { id: 'weather', visible: false });
  expect(environment!.nativeBackground(frame).r).toBe(7 / 255);
});
