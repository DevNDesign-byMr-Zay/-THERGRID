import type { SpatialSurfacePoint, TemporalInstant } from '../renderer/spatial-renderer';
import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';
import { measureSpatialPoints } from './spatial-analysis';

export interface SpatialAreaMeasurement {
  areaSquareMeters: number;
  perimeterMeters: number;
  points: readonly SpatialSurfacePoint[];
  approximation: 'local-tangent-plane';
}
type XY = readonly [number, number];
const radians = Math.PI / 180;
const radius = 6_371_008.8;
const equal = (a: SpatialSurfacePoint, b: SpatialSurfacePoint) => a.latitude === b.latitude && a.longitude === b.longitude;
function cross(a: XY, b: XY, c: XY): number {
  return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
}
function intersects(a: XY, b: XY, c: XY, d: XY): boolean {
  const epsilon = 1e-7;
  const on = (p: XY, q: XY, r: XY) => Math.abs(cross(p,q,r)) <= epsilon &&
    r[0] >= Math.min(p[0],q[0])-epsilon && r[0] <= Math.max(p[0],q[0])+epsilon &&
    r[1] >= Math.min(p[1],q[1])-epsilon && r[1] <= Math.max(p[1],q[1])+epsilon;
  return (cross(a,b,c)*cross(a,b,d) < 0 && cross(c,d,a)*cross(c,d,b) < 0) ||
    on(a,b,c) || on(a,b,d) || on(c,d,a) || on(c,d,b);
}

export function measureSpatialArea(input: readonly SpatialSurfacePoint[]): SpatialAreaMeasurement | null {
  if (input.length < 3 || input.length > 1000 || input.some(p => !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) ||
    Math.abs(p.latitude) > 85 || Math.abs(p.longitude) > 180 || (p.heightMeters != null && !Number.isFinite(p.heightMeters)))) return null;
  const points = input.map(p => ({ ...p }));
  if (equal(points[0], points.at(-1)!)) points.pop();
  if (points.length < 3 || new Set(points.map(p => `${p.latitude}:${p.longitude}`)).size !== points.length) return null;
  const longitudes = points.map(p => points[0].longitude + ((p.longitude - points[0].longitude + 540) % 360 - 180));
  const latitude = points.reduce((sum,p) => sum+p.latitude,0)/points.length;
  const longitude = longitudes.reduce((sum,p) => sum+p,0)/points.length;
  const xy: XY[] = points.map((p,i) => [(longitudes[i]-longitude)*radians*radius*Math.cos(latitude*radians), (p.latitude-latitude)*radians*radius]);
  if (xy.some(p => Math.hypot(...p) > 20_000)) return null;
  for (let i=0; i<xy.length; i++) for (let j=i+1; j<xy.length; j++) {
    if (j === i+1 || (i === 0 && j === xy.length-1)) continue;
    if (intersects(xy[i],xy[(i+1)%xy.length],xy[j],xy[(j+1)%xy.length])) return null;
  }
  let twiceArea = 0, perimeterMeters = 0;
  for (let i=0; i<xy.length; i++) {
    const next = (i+1)%xy.length;
    twiceArea += xy[i][0]*xy[next][1]-xy[next][0]*xy[i][1];
    perimeterMeters += measureSpatialPoints(points[i],points[next]).distanceMeters;
  }
  const areaSquareMeters = Math.abs(twiceArea)/2;
  if (!Number.isFinite(areaSquareMeters) || areaSquareMeters < .01) return null;
  return { areaSquareMeters, perimeterMeters, points, approximation: 'local-tangent-plane' };
}

export function spatialAreaToOverlay(area: SpatialAreaMeasurement, time: TemporalInstant): SpatialOverlaySnapshot {
  // Display a horizontal annotation above the ellipsoid/selected surfaces. Depth
  // tessellation can return slightly negative ground heights; the measurement
  // retains those original heights independently of this presentation plane.
  const annotationHeight = Math.max(0, ...area.points.map(p => p.heightMeters ?? 0)) + 3;
  const positions = area.points.map(p => ({ latitude: p.latitude, longitude: p.longitude, heightMeters: annotationHeight }));
  const properties = { authoritative: false, analysisType: 'area-measurement', presentation: 'raised-horizontal-annotation', approximation: area.approximation, areaSquareMeters: area.areaSquareMeters, perimeterMeters: area.perimeterMeters };
  return { id: `operator-area:${time.iso}`, layerId: 'analysis', eventTime: time.iso, sourceTime: null, fetchedAt: null,
    live: false, stale: false, fallback: false, attribution: 'Operator local tangent-plane area; not terrain surface area',
    nodes: positions.map((position,i) => ({ id: `area:vertex:${i}`, kind: 'analysis-point', position, label: `Vertex ${i+1}`, properties })),
    edges: positions.map((from,i) => ({ id: `area:edge:${i}`, kind: 'analysis-line', from, to: { ...positions[(i+1)%positions.length] }, properties })),
    areas: [{ id: 'area:polygon', kind: 'analysis-area', positions: positions.map(p => ({ ...p })), properties }] };
}
