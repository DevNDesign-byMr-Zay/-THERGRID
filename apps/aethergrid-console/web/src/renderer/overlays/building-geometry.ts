import type { OverlayCoordinate, SpatialOverlayArea } from './spatial-overlay';

export type BuildingHeightCategory = 'explicit-tag' | 'estimated-tag' | 'levels-derived' | 'modeled';
export interface BuildingGeometry {
  ring: readonly OverlayCoordinate[];
  baseM: number;
  topM: number;
  wallTopM: number;
  roofFaces: readonly (readonly OverlayCoordinate[])[];
  heightCategory: BuildingHeightCategory;
  limitation: string | null;
}

const cross = (a: OverlayCoordinate, b: OverlayCoordinate, c: OverlayCoordinate) =>
  (b.longitude - a.longitude) * (c.latitude - a.latitude) -
  (b.latitude - a.latitude) * (c.longitude - a.longitude);

/** OSM height tags describe mapped massing, not a surveyed facade or measurement. */
const geometryCache = new WeakMap<SpatialOverlayArea, BuildingGeometry | null>();
export function buildingGeometry(area: SpatialOverlayArea): BuildingGeometry | null {
  if (geometryCache.has(area)) return geometryCache.get(area)!;
  const geometry = computeBuildingGeometry(area);
  geometryCache.set(area, geometry);
  return geometry;
}
function computeBuildingGeometry(area: SpatialOverlayArea): BuildingGeometry | null {
  let ring = area.positions;
  if (ring.length > 3 && ring[0].longitude === ring.at(-1)?.longitude && ring[0].latitude === ring.at(-1)?.latitude) ring = ring.slice(0, -1);
  if (ring.length < 3 || ring.some((p) => !Number.isFinite(p.longitude) || !Number.isFinite(p.latitude) || Math.abs(p.longitude) > 180 || Math.abs(p.latitude) > 90)) return null;
  if (new Set(ring.map((p) => `${p.longitude},${p.latitude}`)).size !== ring.length) return null;
  const baseM = Number(area.properties?.minHeightM ?? 0);
  const topM = Number(area.properties?.heightM ?? 12);
  if (!Number.isFinite(baseM) || !Number.isFinite(topM) || baseM < 0 || topM <= baseM || topM > 1200) return null;
  const source = area.properties?.heightM == null ? 'inferred' : area.properties?.heightSource;
  const heightCategory: BuildingHeightCategory = source === 'height' ? 'explicit-tag' : source === 'est_height' ? 'estimated-tag' : source === 'building:levels' ? 'levels-derived' : 'modeled';
  const shape = String(area.properties?.roofShape ?? '').trim().toLowerCase();
  const roofHeightM = Number(area.properties?.roofHeightM ?? 0);
  let convex = true;
  let sign = 0;
  let twiceArea = 0;
  const extent = Math.max(
    Math.max(...ring.map((p) => p.longitude)) - Math.min(...ring.map((p) => p.longitude)),
    Math.max(...ring.map((p) => p.latitude)) - Math.min(...ring.map((p) => p.latitude))
  );
  const epsilon = extent * extent * 1e-10;
  const orientation = (a: OverlayCoordinate, b: OverlayCoordinate, c: OverlayCoordinate) => Math.abs(cross(a, b, c)) <= epsilon ? 0 : Math.sign(cross(a, b, c));
  const onSegment = (a: OverlayCoordinate, b: OverlayCoordinate, p: OverlayCoordinate) =>
    orientation(a, b, p) === 0 && p.longitude >= Math.min(a.longitude, b.longitude) && p.longitude <= Math.max(a.longitude, b.longitude) && p.latitude >= Math.min(a.latitude, b.latitude) && p.latitude <= Math.max(a.latitude, b.latitude);
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], b = ring[(i + 1) % ring.length], c = ring[(i + 2) % ring.length];
    twiceArea += a.longitude * b.latitude - b.longitude * a.latitude;
    const turn = orientation(a, b, c);
    // Adjacent segments may share their endpoint, but may not double back.
    if (!turn && (b.longitude - a.longitude) * (c.longitude - b.longitude) + (b.latitude - a.latitude) * (c.latitude - b.latitude) < 0) return null;
    if (turn && sign && turn !== sign) convex = false;
    if (turn) sign = turn;
    // A self-intersecting ring cannot define a supported roof.
    for (let j = i + 2; j < ring.length; j += 1) {
      if (i === 0 && j === ring.length - 1) continue;
      const d = ring[j], e = ring[(j + 1) % ring.length];
      if (onSegment(a, b, d) || onSegment(a, b, e) || onSegment(d, e, a) || onSegment(d, e, b) ||
        (orientation(a, b, d) * orientation(a, b, e) < 0 && orientation(d, e, a) * orientation(d, e, b) < 0)) return null;
    }
  }
  if (Math.abs(twiceArea) < 1e-14) return null;
  const refine = shape === 'pyramidal' && convex && Number.isFinite(roofHeightM) && roofHeightM > 0 && roofHeightM < topM - baseM;
  const wallTopM = refine ? topM - roofHeightM : topM;
  const apex = { longitude: ring.reduce((n, p) => n + p.longitude, 0) / ring.length, latitude: ring.reduce((n, p) => n + p.latitude, 0) / ring.length, heightMeters: topM };
  const roofFaces = refine ? ring.map((p, i) => [
    { ...p, heightMeters: wallTopM },
    { ...ring[(i + 1) % ring.length], heightMeters: wallTopM }, apex
  ]) : [];
  return { ring, baseM, topM, wallTopM, roofFaces, heightCategory,
    limitation: refine || !shape || shape === 'flat' ? null : 'Roof refinement unsupported for this shape, footprint or source dimensions; simple massing retained.' };
}

/** Shared massing edges for the native renderer's explicit wireframe fallback. */
const edgeCache = new WeakMap<SpatialOverlayArea, readonly (readonly [OverlayCoordinate, OverlayCoordinate])[]>();
export function buildingEdges(area: SpatialOverlayArea): readonly (readonly [OverlayCoordinate, OverlayCoordinate])[] {
  if (edgeCache.has(area)) return edgeCache.get(area)!;
  const geometry = buildingGeometry(area);
  if (!geometry) return [];
  const edges: [OverlayCoordinate, OverlayCoordinate][] = [];
  geometry.ring.forEach((point, index) => {
    const next = geometry.ring[(index + 1) % geometry.ring.length];
    const base = { ...point, heightMeters: geometry.baseM };
    const top = { ...point, heightMeters: geometry.wallTopM };
    edges.push([base, { ...next, heightMeters: geometry.baseM }], [base, top], [top, { ...next, heightMeters: geometry.wallTopM }]);
  });
  geometry.roofFaces.forEach((face) => edges.push([face[0], face[2]]));
  edgeCache.set(area, edges);
  return edges;
}
