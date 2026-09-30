import type {
  OverlayCoordinate,
  OverlayNodeKind,
  SpatialOverlayArea,
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

interface CityRoad {
  id: string;
  name?: string;
  highwayType?: string;
  path?: readonly (readonly [number, number])[];
}

interface CityLinearWater {
  id: string;
  name?: string;
  waterwayType?: string;
  path?: readonly (readonly [number, number])[];
}

interface CityAreaFeature {
  id: string;
  name?: string;
  waterType?: string;
  greenType?: string;
  footprint?: readonly (readonly [number, number])[];
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
  roads?: readonly CityRoad[];
  waterAreas?: readonly CityAreaFeature[];
  waterways?: readonly CityLinearWater[];
  coastlines?: readonly CityLinearWater[];
  greenAreas?: readonly CityAreaFeature[];
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


function sourceFields(mesh: CityMeshResponse) {
  const source = sourceFields(mesh);
  const eventTime = source.eventTime;
  return {
    eventTime,
    sourceTime: source.upstreamTimestamp ?? null,
    fetchedAt: source.fetchedAt ?? null,
    live: source.live === true,
    stale: false,
    fallback: source.live !== true,
    attribution: source.attribution ?? source.provider ?? null
  };
}

function pathToEdges(
  mesh: CityMeshResponse,
  path: readonly (readonly [number, number])[],
  featureId: string,
  kind: SpatialOverlayEdge['kind'],
  label: string,
  properties: Readonly<Record<string, unknown>> = {}
): SpatialOverlayEdge[] {
  const edges: SpatialOverlayEdge[] = [];
  for (let index = 1; index < path.length; index += 1) {
    edges.push({
      id: `${featureId}:segment:${index}`,
      kind,
      from: localMetersToCoordinate(mesh.city, path[index - 1], 6),
      to: localMetersToCoordinate(mesh.city, path[index], 6),
      label,
      intensity: kind === 'coastline' ? 0.82 : kind === 'waterway' ? 0.68 : 0.44,
      properties
    });
  }
  return edges;
}

export function cityMeshToSemanticOverlays(
  mesh: CityMeshResponse
): readonly SpatialOverlaySnapshot[] {
  const source = sourceFields(mesh);

  const roadEdges = (mesh.roads ?? []).flatMap((road) =>
    pathToEdges(
      mesh,
      road.path ?? [],
      road.id,
      'route',
      road.name || road.highwayType || road.id,
      { highwayType: road.highwayType ?? '' }
    )
  );

  const waterEdges = [
    ...(mesh.waterways ?? []).flatMap((waterway) =>
      pathToEdges(
        mesh,
        waterway.path ?? [],
        waterway.id,
        'waterway',
        waterway.name || waterway.waterwayType || waterway.id,
        { waterwayType: waterway.waterwayType ?? '' }
      )
    ),
    ...(mesh.coastlines ?? []).flatMap((coastline) =>
      pathToEdges(
        mesh,
        coastline.path ?? [],
        coastline.id,
        'coastline',
        coastline.name || 'Coastline'
      )
    )
  ];

  const waterAreas: SpatialOverlayArea[] = (mesh.waterAreas ?? [])
    .filter((area) => (area.footprint?.length ?? 0) >= 3)
    .map((area) => ({
      id: area.id,
      kind: 'water',
      positions: (area.footprint ?? []).map((point) =>
        localMetersToCoordinate(mesh.city, point, 4)
      ),
      label: area.name || area.waterType || area.id,
      intensity: 0.62,
      properties: { waterType: area.waterType ?? '' }
    }));

  const greenAreas: SpatialOverlayArea[] = (mesh.greenAreas ?? [])
    .filter((area) => (area.footprint?.length ?? 0) >= 3)
    .map((area) => ({
      id: area.id,
      kind: 'green',
      positions: (area.footprint ?? []).map((point) =>
        localMetersToCoordinate(mesh.city, point, 5)
      ),
      label: area.name || area.greenType || area.id,
      intensity: 0.52,
      properties: { greenType: area.greenType ?? '' }
    }));

  return [
    {
      id: `roads:${mesh.city.id}:${source.eventTime}`,
      layerId: 'roads',
      ...source,
      nodes: [],
      edges: roadEdges,
      areas: []
    },
    {
      id: `water:${mesh.city.id}:${source.eventTime}`,
      layerId: 'water',
      ...source,
      nodes: [],
      edges: waterEdges,
      areas: waterAreas
    },
    {
      id: `green:${mesh.city.id}:${source.eventTime}`,
      layerId: 'green',
      ...source,
      nodes: [],
      edges: [],
      areas: greenAreas
    }
  ];
}

export interface CitySpatialBundle {
  power: SpatialOverlaySnapshot;
  semantics: readonly SpatialOverlaySnapshot[];
}

export function cityMeshToSpatialBundle(mesh: CityMeshResponse): CitySpatialBundle {
  return {
    power: cityMeshToPowerOverlay(mesh),
    semantics: cityMeshToSemanticOverlays(mesh)
  };
}

async function cityMeshRequest(
  url: string,
  errorLabel: string,
  signal?: AbortSignal
): Promise<CityMeshResponse> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal
  });
  if (!response.ok) {
    throw new Error(`${errorLabel} failed with HTTP ${response.status}`);
  }
  return (await response.json()) as CityMeshResponse;
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
    sourceTime: source.sourceTime,
    fetchedAt: source.fetchedAt,
    live: source.live,
    stale: source.stale,
    fallback: source.fallback,
    attribution: source.attribution,
    nodes,
    edges
  };
}

export async function loadCityPowerOverlay(
  cityId: string,
  signal?: AbortSignal
): Promise<SpatialOverlaySnapshot> {
  const mesh = await cityMeshRequest(
    `/api/aethergrid/geospatial/city/${encodeURIComponent(cityId)}`,
    'city power overlay request',
    signal
  );
  return cityMeshToPowerOverlay(mesh);
}


export async function loadCoordinatePowerOverlay(
  latitude: number,
  longitude: number,
  name = 'Coordinate Explorer',
  signal?: AbortSignal
): Promise<SpatialOverlaySnapshot> {
  const query = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    name,
    radiusM: '1200'
  });
  const mesh = await cityMeshRequest(
    `/api/aethergrid/geospatial/point?${query.toString()}`,
    'coordinate power overlay request',
    signal
  );
  return cityMeshToPowerOverlay(mesh);
}


export async function loadCitySpatialBundle(
  cityId: string,
  signal?: AbortSignal
): Promise<CitySpatialBundle> {
  const mesh = await cityMeshRequest(
    `/api/aethergrid/geospatial/city/${encodeURIComponent(cityId)}`,
    'city spatial bundle request',
    signal
  );
  return cityMeshToSpatialBundle(mesh);
}

export async function loadCoordinateSpatialBundle(
  latitude: number,
  longitude: number,
  name = 'Coordinate Explorer',
  signal?: AbortSignal
): Promise<CitySpatialBundle> {
  const query = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    name,
    radiusM: '1200'
  });
  const mesh = await cityMeshRequest(
    `/api/aethergrid/geospatial/point?${query.toString()}`,
    'coordinate spatial bundle request',
    signal
  );
  return cityMeshToSpatialBundle(mesh);
}
