import { expect, test } from '@playwright/test';
import { Cartesian3, Ellipsoid, Entity, PolygonGraphics, PropertyBag } from 'cesium';
import { pickCesiumSurface } from '../src/renderer/cesium/surface-picking';

function viewer(hit: unknown, terrain = false) {
  let depthReads = 0;
  return { get depthReads() { return depthReads; }, value: { scene: { pickPositionSupported: true, pick: () => hit,
    pickPosition: () => { depthReads++; return Cartesian3.fromDegrees(-74,40,110); },
    globe: { ellipsoid: Ellipsoid.WGS84, pick: () => terrain ? Cartesian3.fromDegrees(-74,40,8) : undefined } },
    camera: { getPickRay: () => ({}), pickEllipsoid: () => Cartesian3.fromDegrees(-74,40,0) } } as any };
}
test('empty tokenless scene picks the ellipsoid without consuming unrelated depth', () => {
  const fixture = viewer(undefined);
  const picked = pickCesiumSurface(fixture.value,{ x: 20,y: 20 },false)!;
  expect(fixture.depthReads).toBe(0);
  expect(picked.source).toBe('ellipsoid');
  expect(picked.heightMeters).toBeCloseTo(0);
});
test('raised analytical annotations never become measured physical surfaces', () => {
  const annotation = new Entity({ polygon: new PolygonGraphics(), properties: new PropertyBag({ overlayKind: 'analysis-area', authoritative: false }) });
  const fixture = viewer({ id: annotation });
  expect(pickCesiumSurface(fixture.value,{x:20,y:20},false)?.source).toBe('ellipsoid');
  expect(fixture.depthReads).toBe(0);
});
test('configured terrain pick retains terrain source while physical building uses depth', () => {
  const ground = viewer(undefined,true);
  expect(pickCesiumSurface(ground.value,{x:20,y:20},true)?.source).toBe('terrain');
  expect(ground.depthReads).toBe(0);
  const building = viewer({ id: { aethergridSourceBuilding: true, id: 'mapped-building', geometryPart: 'body' } });
  expect(pickCesiumSurface(building.value,{x:20,y:20},false)?.heightMeters).toBeCloseTo(110);
  expect(building.depthReads).toBe(1);
});
