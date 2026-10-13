import { expect, test } from '@playwright/test';
import type { SpatialSurfacePoint } from '../src/renderer/spatial-renderer';

async function api() {
  const module = await import('../src/services/spatial-area').catch(() => null);
  expect(module, 'area measurement API must exist').not.toBeNull();
  return module!;
}
const point = (latitude: number, longitude: number): SpatialSurfacePoint => ({ latitude, longitude, source: 'native-projection', heightMeters: null });
const degree = 100 / 6371008.8 * 180 / Math.PI;
const square = () => [point(0, 0), point(0, degree), point(degree, degree), point(degree, 0)];

test('local square has meaningful area and perimeter without claiming terrain area', async () => {
  const { measureSpatialArea, spatialAreaToOverlay } = await api();
  const area = measureSpatialArea(square())!;
  expect(area.areaSquareMeters).toBeCloseTo(10000, 0);
  expect(area.perimeterMeters).toBeCloseTo(400, 1);
  expect(area.approximation).toBe('local-tangent-plane');
  const overlay = spatialAreaToOverlay(area, { iso: '2026-10-12T12:00:00Z', mode: 'historical' });
  expect(overlay.areas![0].kind).toBe('analysis-area');
  expect(overlay.areas![0].properties?.authoritative).toBe(false);
  expect(overlay.sourceTime).toBeNull();
  expect(overlay.live).toBe(false);
});

test('closed rings and small antimeridian polygons remain bounded', async () => {
  const { measureSpatialArea } = await api();
  const ring = square();
  expect(measureSpatialArea([...ring, ring[0]])!.areaSquareMeters).toBe(measureSpatialArea(ring)!.areaSquareMeters);
  const area = measureSpatialArea([point(0,179.9996), point(0,-179.9996), point(.0008,-179.9996), point(.0008,179.9996)])!;
  expect(area.areaSquareMeters).toBeGreaterThan(7000);
  expect(area.areaSquareMeters).toBeLessThan(9000);
});

test('invalid, touching, self crossing and oversized polygons remain unavailable', async () => {
  const { measureSpatialArea } = await api();
  const ring = square();
  for (const input of [[], ring.slice(0,2), [ring[0], ring[0], ring[1]], [ring[0],ring[2],ring[1],ring[3]],
    [point(NaN,0),ring[1],ring[2]], [point(91,0),ring[1],ring[2]], [point(0,181),ring[1],ring[2]],
    [point(0,0),point(0,2),point(2,2),point(2,0)], [point(89.9,0),point(89.9,.01),point(89.91,.01)],
    [point(0,0),point(0,.001),point(.001,.001),point(0,.0005),point(.001,0)]]) {
    expect(measureSpatialArea(input)).toBeNull();
  }
});

test('completed measurement and overlay own their coordinates', async () => {
  const { measureSpatialArea, spatialAreaToOverlay } = await api();
  const ring = square(), area = measureSpatialArea(ring)!;
  ring[0].latitude = 8;
  expect(area.points[0].latitude).toBe(0);
  const overlay = spatialAreaToOverlay(area, { iso: '2026-10-12T12:00:00Z', mode: 'live' });
  (area.points[0] as SpatialSurfacePoint).latitude = 9;
  expect(overlay.areas![0].positions[0].latitude).toBe(0);
});

test('horizontal area annotation clears negative depth-surface tessellation without changing picked heights', async () => {
  const { measureSpatialArea, spatialAreaToOverlay } = await api();
  const points = square().map(point => ({ ...point, source: 'depth-surface' as const, heightMeters: -20 }));
  const area = measureSpatialArea(points)!;
  const overlay = spatialAreaToOverlay(area, { iso: '2026-10-12T12:00:00Z', mode: 'live' });
  expect(overlay.areas![0].positions.every(position => position.heightMeters! >= 3)).toBe(true);
  expect(area.points[0].heightMeters).toBe(-20);
});

test('antimeridian aliases are the same geographic vertex', async () => {
  const { measureSpatialArea } = await api();
  expect(measureSpatialArea([point(0,180),point(0,-180),point(0,-179.999),point(.001,-179.999)])).toBeNull();
});
