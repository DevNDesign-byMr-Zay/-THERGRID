import { buildingGeometry } from '../renderer/overlays/building-geometry';
import type {
  SpatialOverlayArea, SpatialOverlayEdge, SpatialOverlayNode, SpatialOverlaySnapshot
} from '../renderer/overlays/spatial-overlay';
import type { CitySpatialBundle } from './city-power-overlay';

export interface CameraCityTile {
  key: string;
  latitude: number;
  longitude: number;
  radiusM: number;
}
export interface CameraTileCenter { id: string; latitude: number; longitude: number }
export interface CameraTilePosition { latitude: number; longitude: number; heightMeters: number }
export interface LoadedCityTile { key: string; bundle: CitySpatialBundle }

const METERS_PER_DEGREE = 111_320;
export const CITY_TILE_STEP_M = 650;
export const CITY_TILE_RADIUS_M = 450;
export const MAX_STREAMED_TILES = 4;
const MAX_STREAM_DISTANCE_M = 2_600;
const MAX_CAMERA_HEIGHT_M = 4_000;
const wrapLongitude = (longitude: number) => ((longitude + 540) % 360 + 360) % 360 - 180;

/**
 * Snap camera geodetic location to a stable district-relative grid.
 * The central core remains the existing bundled or backend district.
 * Never attempt a large geospatial request when flying at global altitude.
 */
export function cameraCityTile({
  center, camera, stepM = CITY_TILE_STEP_M
}: {
  center: CameraTileCenter;
  camera: CameraTilePosition;
  stepM?: number;
}): CameraCityTile | null {
  if (
    !Number.isFinite(center.latitude) || Math.abs(center.latitude) > 80 ||
    !Number.isFinite(center.longitude) || Math.abs(center.longitude) > 180 ||
    !Number.isFinite(camera.latitude) || Math.abs(camera.latitude) > 90 ||
    !Number.isFinite(camera.longitude) || Math.abs(camera.longitude) > 180 ||
    !Number.isFinite(camera.heightMeters) || camera.heightMeters < 0 ||
    camera.heightMeters > MAX_CAMERA_HEIGHT_M ||
    !Number.isFinite(stepM) || stepM < 250
  ) return null;
  const longitudeMeters = METERS_PER_DEGREE * Math.cos(center.latitude * Math.PI / 180);
  const east = wrapLongitude(camera.longitude - center.longitude) * longitudeMeters;
  const north = (camera.latitude - center.latitude) * METERS_PER_DEGREE;
  if (Math.hypot(east, north) > MAX_STREAM_DISTANCE_M) return null;
  const ix = Math.round(east / stepM);
  const iy = Math.round(north / stepM);
  if (ix === 0 && iy === 0) return null;
  const latitude = center.latitude + iy * stepM / METERS_PER_DEGREE;
  const longitude = wrapLongitude(center.longitude + ix * stepM / longitudeMeters);
  if (Math.abs(latitude) > 90) return null;
  return {
    key: `${center.id}:${ix}:${iy}`,
    latitude,
    longitude,
    radiusM: CITY_TILE_RADIUS_M
  };
}

type Feature = SpatialOverlayArea | SpatialOverlayEdge | SpatialOverlayNode;
const uniqueKey = (item: Feature, layerId: string): string => {
  if (layerId === 'illumination') return String(item.properties?.sourceBuildingId ?? item.properties?.sourceFeatureId ?? item.id);
  if (layerId === 'buildings' || layerId === 'energy') return String(item.properties?.sourceFeatureId ?? item.id);
  return item.id;
};

function mergeLayer(
  base: SpatialOverlaySnapshot,
  parts: readonly { key: string; snapshot: SpatialOverlaySnapshot }[],
  cityId: string
): SpatialOverlaySnapshot {
  if (!parts.length) return base;
  const nodes = new Map(base.nodes.map(item => [uniqueKey(item,base.layerId),item]));
  const edges = new Map(base.edges.map(item => [uniqueKey(item,base.layerId),item]));
  const areas = new Map((base.areas ?? []).map(item => [uniqueKey(item,base.layerId),item]));
  for (const {key,snapshot} of parts) {
    const fromTile = <T extends Feature>(item: T): T => ({
      ...item,
      properties: {
        ...item.properties,
        sourceTileKey: key,
        sourceCityId: item.properties?.cityId ?? null,
        cityId,
        tileSourceTime: snapshot.sourceTime,
        tileProvider: snapshot.attribution
      }
    });
    for (const item of snapshot.nodes) {
      const id = uniqueKey(item,base.layerId);
      if (!nodes.has(id)) nodes.set(id,fromTile(item));
    }
    for (const item of snapshot.edges) {
      const id = uniqueKey(item,base.layerId);
      if (!edges.has(id)) edges.set(id,fromTile(item));
    }
    for (const item of snapshot.areas ?? []) {
      const id = uniqueKey(item,base.layerId);
      if (!areas.has(id)) areas.set(id,fromTile(item));
    }
  }
  return { ...base, nodes:[...nodes.values()], edges:[...edges.values()], areas:[...areas.values()] };
}

function admissible(bundle: CitySpatialBundle): boolean {
  return [bundle.power,bundle.illumination,...bundle.semantics].every(
    overlay => overlay.live && !overlay.stale && !overlay.fallback
  );
}

/**
 * Combine a central district with at most four already validated live tiles.
 * Base data wins duplicate source identities; provenance for every new feature
 * remains attached. No synthetic fallback is ever promoted into the map.
 */
export function mergeCitySpatialTiles(
  base: CitySpatialBundle,
  tiles: readonly LoadedCityTile[],
  { maxTiles = MAX_STREAMED_TILES }: { maxTiles?: number } = {}
): CitySpatialBundle {
  const cap = Number.isFinite(maxTiles) ? Math.max(0, Math.min(MAX_STREAMED_TILES,Math.floor(maxTiles))) : MAX_STREAMED_TILES;
  const accepted = tiles.filter(({bundle}) => admissible(bundle)).slice(-cap || tiles.length);
  if (!cap || !accepted.length) return base;
  const cityId = base.identity.cityId;
  const sections = (layerId: string) => accepted.flatMap(({key,bundle}) => {
    const snapshot = layerId === 'energy' ? bundle.power
      : layerId === 'illumination' ? bundle.illumination
      : bundle.semantics.find(part => part.layerId === layerId);
    return snapshot ? [{key,snapshot}] : [];
  });
  const semantics = base.semantics.map(part=>mergeLayer(part,sections(part.layerId),cityId));
  const power = mergeLayer(base.power,sections('energy'),cityId);
  const illumination = mergeLayer(base.illumination,sections('illumination'),cityId);
  const buildings = semantics.find(part=>part.layerId==='buildings')?.areas ?? [];
  const geometry = buildings.map(buildingGeometry).filter((item):item is NonNullable<typeof item> => item !== null);
  const count = geometry.length;
  const heights = geometry.map(g=>g.topM).sort((a,b)=>a-b);
  const percentile = (fraction:number) => heights[Math.floor((count-1)*fraction)] ?? 0;
  const portion = (category:string) => count ? 100*geometry.filter(g=>g.heightCategory===category).length/count : 0;
  const modeled = portion('modeled');
  const named = new Map(base.identity.namedStructures.map(item=>[item.id,item]));
  for (const {bundle} of accepted) for (const item of bundle.identity.namedStructures) {
    if (!named.has(item.id)) named.set(item.id,item);
  }
  return {
    power,semantics,illumination,
    identity:{
      ...base.identity,
      buildingCount:count,
      maxHeightM:percentile(1),
      p95HeightM:percentile(.95),
      medianHeightM:percentile(.5),
      sourceBackedHeightCoveragePercent:100-modeled,
      explicitHeightCoveragePercent:portion('explicit-tag'),
      estimatedHeightCoveragePercent:portion('estimated-tag'),
      levelsDerivedHeightCoveragePercent:portion('levels-derived'),
      modeledHeightCoveragePercent:modeled,
      refinedRoofCount:geometry.filter(g=>g.roofFaces.length>0).length,
      limitedRoofCount:geometry.filter(g=>g.limitation!==null).length,
      buildingPartCount:buildings.filter(a=>a.properties?.buildingPart===true).length,
      roofTaggedCount:buildings.filter(a=>Boolean(a.properties?.roofShape)).length,
      namedStructureCount:named.size,
      namedStructures:[...named.values()].sort((a,b)=>b.heightM-a.heightM).slice(0,12),
      tallStructureCount:geometry.filter(g=>g.topM>=Math.max(80,percentile(.95))).length
    }
  };
}
