import type {
  OverlayCoordinate,
  OverlayNodeKind,
  SpatialOverlayEdge,
  SpatialOverlayNode,
  SpatialOverlaySnapshot
} from '../renderer/overlays/spatial-overlay';

interface CityDescriptor {
  id: string;
  lat: number;
  lon: number;
}

interface CityPowerAsset {
  id: string;
  name?: string;
  powerType?: string;
  voltage?: number | null;
  operator?: string;
  position?: readonly [number, number];
}

interface CityPowerLine {
  id: string;
  name?: string;
  powerType?: string;
  voltage?: number | null;
  operator?: string;
  path?: readonly (readonly [number, number])[];
}

interface CityMeshResponse {
  city: CityDescriptor;
  source?: {
    provider?: string;
    live?: boolean;
    attribution?: string | null;
    fetchedAt?: string | null;
    upstreamTimestamp?: string | null;
  };
  powerAssets?: readonly CityPowerAsset[];
  powerLines?: readonly CityPowerLine[];
}

function localMetersToCoordinate(
  city: CityDescriptor,
  point: readonly [number, number],
  heightMeters = 24
): OverlayCoordinate {
  const [xMeters, zMeters] = point;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLon =
    Math.cos((city.lat * Math.PI) / 180) * metersPerDegreeLat;

  return {
    latitude: city.lat + zMeters / metersPerDegreeLat,
    longitude: city.lon + xMeters / Math.max(1, metersPerDegreeLon),
    heightMeters
  };
}

function nodeKind(powerType = ''): OverlayNodeKind {
  if (powerType === 'substation' || powerType === 'transformer') return 'substation';
  if (powerType === 'plant' || powerType === 'generator') return 'generation';
  return 'asset';
}

function voltageIntensity(voltage: number | null | undefined): number {
  if (!Number.isFinite(voltage) || Number(voltage) <= 0) return 0.42;
  const normalized = Math.log10(Math.max(1, Number(voltage))) / 6;
  return Math.min(1, Math.max(0.25, normalized));
}

export function cityMeshToPowerOverlay(mesh: CityMeshResponse): SpatialOverlaySnapshot {
  const source = mesh.source ?? {};
  const eventTime = source.fetchedAt ?? new Date().toISOString();

  const nodes: SpatialOverlayNode[] = (mesh.powerAssets ?? [])
    .filter((asset) => Array.isArray(asset.position) && asset.position.length >= 2)
    .map((asset) => ({
      id: asset.id,
      kind: nodeKind(asset.powerType),
      position: localMetersToCoordinate(mesh.city, asset.position as readonly [number, number], 28),
      label: asset.name || asset.powerType || asset.id,
      value: asset.voltage ?? null,
      unit: asset.voltage ? 'V' : null,
      intensity: voltageIntensity(asset.voltage),
      properties: {
        operator: asset.operator ?? '',
        powerType: asset.powerType ?? ''
      }
    }));

  const edges: SpatialOverlayEdge[] = [];
  for (const line of mesh.powerLines ?? []) {
    const path = line.path ?? [];
    for (let index = 1; index < path.length; index += 1) {
      edges.push({
        id: `${line.id}:segment:${index}`,
        kind: 'transmission',
        from: localMetersToCoordinate(mesh.city, path[index - 1], 34),
        to: localMetersToCoordinate(mesh.city, path[index], 34),
        label: line.name || line.powerType || line.id,
        value: line.voltage ?? null,
        unit: line.voltage ? 'V' : null,
        intensity: voltageIntensity(line.voltage),
        properties: {
          sourceLineId: line.id,
          operator: line.operator ?? '',
          powerType: line.powerType ?? ''
        }
      });
    }
  }

  return {
    id: `power:${mesh.city.id}:${eventTime}`,
    layerId: 'energy',
    eventTime,
    sourceTime: source.upstreamTimestamp ?? null,
    fetchedAt: source.fetchedAt ?? null,
    live: source.live === true,
    stale: false,
    fallback: source.live !== true,
    attribution: source.attribution ?? source.provider ?? null,
    nodes,
    edges
  };
}

export async function loadCityPowerOverlay(
  cityId: string,
  signal?: AbortSignal
): Promise<SpatialOverlaySnapshot> {
  const response = await fetch(
    `/api/aethergrid/geospatial/city/${encodeURIComponent(cityId)}`,
    {
      headers: { accept: 'application/json' },
      signal
    }
  );
  if (!response.ok) {
    throw new Error(`city power overlay request failed with HTTP ${response.status}`);
  }
  return cityMeshToPowerOverlay((await response.json()) as CityMeshResponse);
}
