import { expect, test } from '@playwright/test';
import {
  DataSourceCollection,
  ImageryLayerCollection,
  PrimitiveCollection,
  JulianDate,
  Cartesian3,
} from 'cesium';

const frame = {
  urlTemplate: 'https://tilecache.rainviewer.com/v2/radar/123/256/{z}/{x}/{y}/2/1_1.png',
  frameTime: '2026-10-20T08:00:00Z',
  maximumLevel: 7,
  credit: 'Weather radar by RainViewer',
  coverageUrl: 'https://tilecache.rainviewer.com/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png',
  coverageVisible: false,
};
test('radar imagery stays geographically tiled with a bounded cache and hides outside live mode', async () => {
  const path = '../src/renderer/cesium/radar-weather-layer';
  const { RadarWeatherLayer } = await import(path);
  const imageryLayers = new ImageryLayerCollection();
  const layer = new RadarWeatherLayer({ imageryLayers, scene: { requestRender() {} } } as any);
  for (let i = 0; i < 10; i++)
    layer.apply({ ...frame, urlTemplate: frame.urlTemplate.replace('/123/', `/${i}/`) });
  expect(imageryLayers.length).toBeLessThanOrEqual(4);
  layer.setTime({ mode: 'historical', iso: frame.frameTime });
  for (let i = 0; i < imageryLayers.length; i++) expect(imageryLayers.get(i).show).toBe(false);
  layer.setTime({ mode: 'live', iso: frame.frameTime });
  expect([...Array(imageryLayers.length)].some((_, i) => imageryLayers.get(i).show)).toBe(true);
  layer.setVisible(false, 0.5);
  for (let i = 0; i < imageryLayers.length; i++) expect(imageryLayers.get(i).show).toBe(false);
  layer.destroy();
  expect(imageryLayers.length).toBe(0);
  imageryLayers.destroy();
});

test('aircraft animation interpolates only between recent observed fixes and embeds the 3D model', async () => {
  const path = '../src/renderer/cesium/network-overlay-layer';
  const { NetworkOverlayLayer } = await import(path);
  const primitives = new PrimitiveCollection(),
    dataSources = new DataSourceCollection();
  const layer = new NetworkOverlayLayer({
    dataSources,
    scene: { primitives, requestRender() {} },
  } as any);
  await Promise.resolve();
  const snapshot = (lon: number, time: string) => ({
    id: time,
    layerId: 'aviation',
    eventTime: time,
    sourceTime: time,
    fetchedAt: time,
    live: true,
    stale: false,
    fallback: false,
    nodes: [
      {
        id: 'ac',
        kind: 'aircraft',
        position: { latitude: 40, longitude: lon, heightMeters: 3000 },
        properties: {
          eventType: 'aircraft',
          render3d: true,
          trackDegrees: 90,
          truthState: 'observed',
          observedAt: time,
        },
      },
    ],
    edges: [],
  });
  layer.apply(snapshot(-74, '2026-10-20T08:00:00Z') as any);
  const source = dataSources.get(0),
    first = source.entities.getById('ac').position.getValue(JulianDate.now());
  layer.apply(snapshot(-73.99, '2026-10-20T08:00:15Z') as any);
  const entity = source.entities.getById('ac'),
    start = entity.position.getValue(JulianDate.now());
  expect(Cartesian3.distance(first, start)).toBeLessThan(100);
  expect(entity.model.uri.getValue()).toMatch(/^data:|assets/);
  expect(entity.point.disableDepthTestDistance.getValue()).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const end = entity.position.getValue(JulianDate.now());
  expect(Cartesian3.distance(first, end)).toBeGreaterThan(500);
  const incomplete = snapshot(-73.98, '2026-10-20T08:00:30Z');
  (incomplete.nodes[0].properties as any).trackDegrees = null;
  incomplete.nodes[0].properties.render3d = false;
  layer.apply(incomplete as any);
  expect(source.entities.getById('ac').model).toBeUndefined();
  expect(source.entities.getById('ac').point.distanceDisplayCondition.getValue().near).toBe(0);
  layer.destroy();
  dataSources.destroy();
  primitives.destroy();
});

test('public spatial tokens persist as browser configuration and reject private-shaped inputs', async () => {
  const path = '../src/services/public-spatial-connection';
  const { savePublicSpatialToken, readPublicSpatialToken } = await import(path);
  const previous = (globalThis as any).localStorage;
  const memory = new Map();
  (globalThis as any).localStorage = {
    getItem: (key: string) => memory.get(key),
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  };
  try {
    expect(() => savePublicSpatialToken('bad token')).toThrow();
    savePublicSpatialToken('eyJ.public-token-for-browser.12345');
    expect(readPublicSpatialToken()).toBe('eyJ.public-token-for-browser.12345');
    savePublicSpatialToken('');
    expect(readPublicSpatialToken()).toBe('');
  } finally {
    (globalThis as any).localStorage = previous;
  }
});
