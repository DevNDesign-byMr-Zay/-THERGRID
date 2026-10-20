import { expect, test } from '@playwright/test';
import { buildingGeometry, buildingEdges } from '../src/renderer/overlays/building-geometry';
import { cityMeshToSpatialBundle } from '../src/services/city-power-overlay';
import { NetworkOverlayLayer } from '../src/renderer/cesium/network-overlay-layer';
import { DataSourceCollection, PolygonGeometry, PrimitiveCollection } from 'cesium';

const rectangle = [[0,0],[.002,0],[.002,.001],[0,.001]].map(([longitude, latitude]) => ({longitude, latitude}));
const area = (roofShape: string) => ({id: 'mapped-roof', kind: 'building' as const, positions: rectangle,
  properties: {heightM: 30, minHeightM: 4, heightSource: 'height', roofShape, roofHeightM: 6}});

for (const roofShape of ['gabled', 'hipped']) {
  test(`${roofShape} mapped rectangular roofs preserve height and a closed surface`, () => {
    const geometry = buildingGeometry(area(roofShape))!;
    expect(geometry.wallTopM).toBe(24);
    expect(geometry.roofFaces).toHaveLength(4);
    expect(geometry.limitation).toBeNull();
    const edges = new Map<string, number>();
    for (const face of geometry.roofFaces) {
      for (let i = 0; i < face.length; i++) {
        const key = [JSON.stringify(face[i]), JSON.stringify(face[(i+1)%face.length])].sort().join('|');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect([...edges.values()].filter(n => n === 1)).toHaveLength(4);
    expect([...edges.values()].every(n => n <= 2)).toBe(true);
    expect(Math.max(...geometry.roofFaces.flat().map(p => p.heightMeters!))).toBe(30);
    expect(buildingEdges(area(roofShape)).some(([a,b]) => a.heightMeters === 30 && b.heightMeters === 30)).toBe(true);
    expect(buildingGeometry({...area(roofShape), positions: [...rectangle].reverse()})!.roofFaces).toHaveLength(4);
  });
}

test('nonrectangular gabled roofs retain honest simple massing', () => {
  const geometry = buildingGeometry({...area('gabled'), positions: [rectangle[0], rectangle[1], {...rectangle[2], longitude: .0015}, rectangle[3]]})!;
  expect(geometry.roofFaces).toHaveLength(0);
  expect(geometry.wallTopM).toBe(30);
  expect(geometry.limitation).toContain('unsupported');
});

test('courtyard source rings survive conversion, mesh triangulation and every visual mode', async () => {
  const mesh = {city: {id: 'courtyard', lat: 40, lon: -74}, buildings: [{id: 'mapped-court', heightM: 30, heightSource: 'height',
    footprint: [[0,0],[100,0],[100,100],[0,100]], holes: [[[30,30],[70,30],[70,70],[30,70]]]}]};
  const bundle = cityMeshToSpatialBundle(mesh);
  const snapshot = bundle.semantics.find(s => s.layerId === 'buildings')!;
  const mapped = snapshot.areas![0];
  const geometry = buildingGeometry(mapped)!;
  expect(geometry.holes).toHaveLength(1);
  expect(buildingEdges(mapped)).toHaveLength(24);
  const primitives = new PrimitiveCollection();
  const dataSources = new DataSourceCollection();
  const layer = new NetworkOverlayLayer({dataSources, scene: {primitives, requestRender() {}}} as any);
  await Promise.resolve();
  try {
    layer.apply(snapshot);
    const body = primitives.get(0);
    const lines = primitives.get(1);
    const built = PolygonGeometry.createGeometry(body.geometryInstances[0].geometry)!;
    expect(built.indices!.length).toBeGreaterThan(0);
    expect(body.geometryInstances[0].geometry._polygonHierarchy.holes).toHaveLength(1);
    for (const mode of ['solid','wireframe','holographic','xray','grid','reality'] as const) {
      layer.setPresentation(mode, 1);
      expect(lines.show, mode).toBe(true);
      expect(body.show, mode).toBe(mode !== 'wireframe');
      expect(lines.geometryInstances).toHaveLength(24);
    }
    layer.setVisible(false);
    expect(lines.show).toBe(false);
    expect(body.show).toBe(false);
  } finally { layer.destroy(); dataSources.destroy(); primitives.destroy(); }
});

test('invalid courtyard rings are withheld instead of filled as solid buildings', () => {
  const outside = rectangle.map(p => ({...p, longitude: p.longitude + .01}));
  expect(buildingGeometry({...area('flat'), holes: [outside]})).toBeNull();
  const crossing = [{longitude: .001, latitude: .0005}, {longitude: .003, latitude: .0005}, {longitude: .001, latitude: .0008}];
  expect(buildingGeometry({...area('flat'), holes: [crossing]})).toBeNull();
});

test('all refreshed city datasets admit courtyards and preserve geographic coordinates', async () => {
  const { readFile } = await import('node:fs/promises');
  const { gunzipSync } = await import('node:zlib');
  const { resolve } = await import('node:path');
  for (const id of ['new-york','london','tokyo','dubai','singapore','sao-paulo','lagos','sydney']) {
    const mesh = JSON.parse(gunzipSync(await readFile(resolve('../assets/cities', `${id}.json.gz`))).toString());
    const snapshot = cityMeshToSpatialBundle(mesh).semantics.find(s => s.layerId === 'buildings')!;
    const courtyards = snapshot.areas!.filter(area => buildingGeometry(area)!.holes.length > 0);
    expect(courtyards.length, id).toBeGreaterThan(0);
    expect(snapshot.areas!.length, id).toBeGreaterThan(100);
    expect(snapshot.areas!.every(mapped => buildingGeometry(mapped)!.ring.every(p => Math.abs(p.latitude - mesh.city.lat) < .05 && Math.abs(p.longitude - mesh.city.lon) < .05)), id).toBe(true);
    console.info(`${id}: ${snapshot.areas!.length} admitted buildings, ${courtyards.length} courtyards`);
  }
});
