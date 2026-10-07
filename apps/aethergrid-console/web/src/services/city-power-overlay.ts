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

interface CityBuilding {
  id: string;
  name?: string;
  heightM?: number | null;
  heightSource?: string | null;
  minHeightM?: number | null;
  levels?: number | null;
  buildingType?: string | null;
  buildingPart?: boolean;
  buildingMaterial?: string | null;
  buildingColor?: string | null;
  roofShape?: string | null;
  roofHeightM?: number | null;
  roofMaterial?: string | null;
  roofColor?: string | null;
  footprint?: readonly (readonly [number, number])[];
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

export interface CityIdentitySummary {
  cityId: string;
  district: string | null;
  buildingCount: number;
  maxHeightM: number;
  p95HeightM: number;
  medianHeightM: number;
  sourceBackedHeightCoveragePercent: number;
  buildingPartCount: number;
  roofTaggedCount: number;
  namedStructureCount: number;
  tallStructureCount: number;
  arrivalHeadingDegrees: number;
  namedStructures: readonly {
    id: string;
    name: string;
    heightM: number;
    heightSource?: string | null;
  }[];
  upstreamTimestamp: string | null;
  sourceProvider: string | null;
  live: boolean;
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
  buildings?: readonly CityBuilding[];
  powerAssets?: readonly CityPowerAsset[];
  powerLines?: readonly CityPowerLine[];
  roads?: readonly CityRoad[];
  waterAreas?: readonly CityAreaFeature[];
  waterways?: readonly CityLinearWater[];
  coastlines?: readonly CityLinearWater[];
  greenAreas?: readonly CityAreaFeature[];
  skylineProfile?: Partial<CityIdentitySummary>;
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


interface OverlaySourceFields {
  eventTime: string;
  sourceTime: string | null;
  fetchedAt: string | null;
  live: boolean;
  stale: boolean;
  fallback: boolean;
  attribution: string | null;
}

function sourceFields(mesh: CityMeshResponse): OverlaySourceFields {
  const source = mesh.source ?? {};
  const eventTime = source.fetchedAt ?? new Date().toISOString();
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
      properties: {
        sourceFeatureId: featureId,
        sourceDataset: 'osm-overpass',
        cityId: mesh.city.id,
        ...properties
      }
    });
  }
  return edges;
}

function cityMeshToBuildingOverlay(
  mesh: CityMeshResponse
): SpatialOverlaySnapshot {
  const source = sourceFields(mesh);
  const areas: SpatialOverlayArea[] = (mesh.buildings ?? [])
    .filter((building) => (building.footprint?.length ?? 0) >= 3)
    .map((building) => {
      const minHeightM = Math.max(0, Number(building.minHeightM ?? 0));
      const heightM = Math.max(
        minHeightM + 3.2,
        Number(building.heightM ?? minHeightM + 12)
      );
      const heightSource = String(building.heightSource ?? 'inferred');
      const sourceBacked =
        heightSource !== 'inferred' && heightSource !== 'synthetic-fallback';

      return {
        id: building.id,
        kind: 'building',
        positions: (building.footprint ?? []).map((point) =>
          localMetersToCoordinate(mesh.city, point, 0)
        ),
        label: building.name || building.buildingType || building.id,
        intensity: Math.min(1, Math.max(0.16, heightM / 320)),
        properties: {
          sourceFeatureId: building.id,
          sourceDataset: 'osm-overpass',
          cityId: mesh.city.id,
          presentationType: 'source-backed-building',
          sourceBacked,
          heightM,
          minHeightM,
          heightSource,
          levels: building.levels ?? null,
          buildingType: building.buildingType ?? '',
          buildingPart: building.buildingPart === true,
          buildingMaterial: building.buildingMaterial ?? '',
          buildingColor: building.buildingColor ?? '',
          roofShape: building.roofShape ?? '',
          roofHeightM: building.roofHeightM ?? 0,
          roofMaterial: building.roofMaterial ?? '',
          roofColor: building.roofColor ?? ''
        }
      };
    });

  return {
    id: `buildings:${mesh.city.id}:${source.eventTime}`,
    layerId: 'buildings',
    ...source,
    nodes: [],
    edges: [],
    areas
  };
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
      properties: {
        sourceFeatureId: area.id,
        sourceDataset: 'osm-overpass',
        cityId: mesh.city.id,
        waterType: area.waterType ?? ''
      }
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
      properties: {
        sourceFeatureId: area.id,
        sourceDataset: 'osm-overpass',
        cityId: mesh.city.id,
        greenType: area.greenType ?? ''
      }
    }));

  return [
    cityMeshToBuildingOverlay(mesh),
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
  illumination: SpatialOverlaySnapshot;
  identity: CityIdentitySummary;
}


function centroid(
  footprint: readonly (readonly [number, number])[] | undefined
): readonly [number, number] | null {
  if (!footprint?.length) return null;
  const points =
    footprint.length > 1 &&
    footprint[0][0] === footprint.at(-1)?.[0] &&
    footprint[0][1] === footprint.at(-1)?.[1]
      ? footprint.slice(0, -1)
      : footprint;
  if (!points.length) return null;

  const sum = points.reduce(
    (accumulator, point) => [
      accumulator[0] + Number(point[0] || 0),
      accumulator[1] + Number(point[1] || 0)
    ] as [number, number],
    [0, 0] as [number, number]
  );
  return [sum[0] / points.length, sum[1] / points.length];
}

function arrivalHeadingDegrees(mesh: CityMeshResponse): number {
  const candidates = (mesh.buildings ?? [])
    .map((building) => ({
      building,
      center: centroid(building.footprint)
    }))
    .filter(
      (item): item is { building: CityBuilding; center: readonly [number, number] } =>
        Boolean(item.center)
    )
    .sort(
      (a, b) =>
        Number(b.building.heightM ?? 0) - Number(a.building.heightM ?? 0)
    )
    .slice(0, 80);

  if (!candidates.length) return 0;

  let weightedX = 0;
  let weightedNorth = 0;
  let totalWeight = 0;
  for (const item of candidates) {
    const weight = Math.max(8, Number(item.building.heightM ?? 8));
    weightedX += item.center[0] * weight;
    weightedNorth += item.center[1] * weight;
    totalWeight += weight;
  }

  const x = weightedX / Math.max(1, totalWeight);
  const north = weightedNorth / Math.max(1, totalWeight);
  const magnitude = Math.hypot(x, north);

  if (magnitude >= 40) {
    const towardSkyline = (Math.atan2(x, north) * 180) / Math.PI;
    return ((towardSkyline + 180) % 360 + 360) % 360;
  }

  const meanX =
    candidates.reduce((sum, item) => sum + item.center[0], 0) / candidates.length;
  const meanNorth =
    candidates.reduce((sum, item) => sum + item.center[1], 0) / candidates.length;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const item of candidates) {
    const dx = item.center[0] - meanX;
    const dy = item.center[1] - meanNorth;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }

  const axisFromEast = 0.5 * Math.atan2(2 * xy, xx - yy);
  const axisFromNorth = 90 - (axisFromEast * 180) / Math.PI;
  return ((axisFromNorth + 90) % 360 + 360) % 360;
}

function cityIdentity(mesh: CityMeshResponse): CityIdentitySummary {
  const profile = mesh.skylineProfile ?? {};
  return {
    cityId: mesh.city.id,
    district: profile.district ?? null,
    buildingCount: Number(profile.buildingCount ?? 0),
    maxHeightM: Number(profile.maxHeightM ?? 0),
    p95HeightM: Number(profile.p95HeightM ?? 0),
    medianHeightM: Number(profile.medianHeightM ?? 0),
    sourceBackedHeightCoveragePercent: Number(profile.sourceBackedHeightCoveragePercent ?? 0),
    buildingPartCount: Number(profile.buildingPartCount ?? 0),
    roofTaggedCount: Number(profile.roofTaggedCount ?? 0),
    namedStructureCount: Number(profile.namedStructureCount ?? 0),
    tallStructureCount: Number(profile.tallStructureCount ?? 0),
    arrivalHeadingDegrees: arrivalHeadingDegrees(mesh),
    namedStructures: Array.isArray(profile.namedStructures)
      ? profile.namedStructures
          .filter((item): item is NonNullable<CityIdentitySummary['namedStructures'][number]> =>
            Boolean(item?.id && item?.name)
          )
          .slice(0, 12)
      : [],
    upstreamTimestamp: profile.upstreamTimestamp ?? mesh.source?.upstreamTimestamp ?? null,
    sourceProvider: profile.sourceProvider ?? mesh.source?.provider ?? null,
    live: profile.live ?? mesh.source?.live === true
  };
}


function cityMeshToIlluminationOverlay(
  mesh: CityMeshResponse
): SpatialOverlaySnapshot {
  const source = sourceFields(mesh);
  const candidates = (mesh.buildings ?? [])
    .map((building) => ({
      building,
      center: centroid(building.footprint),
      heightM: Math.max(8, Number(building.heightM ?? 12))
    }))
    .filter(
      (
        item
      ): item is {
        building: CityBuilding;
        center: readonly [number, number];
        heightM: number;
      } => Boolean(item.center)
    );

  const byHeight = [...candidates].sort((a, b) => b.heightM - a.heightM);
  const selected = new Map<string, (typeof byHeight)[number]>();

  for (const item of byHeight.slice(0, 160)) {
    selected.set(item.building.id, item);
  }

  const remaining = candidates.filter(
    (item) => !selected.has(item.building.id)
  );
  const stride = Math.max(1, Math.ceil(remaining.length / 340));
  for (let index = 0; index < remaining.length; index += stride) {
    const item = remaining[index];
    if (item) selected.set(item.building.id, item);
    if (selected.size >= 500) break;
  }

  const nodes: SpatialOverlayNode[] = [...selected.values()].map((item) => ({
    id: `urban-light:${mesh.city.id}:${item.building.id}`,
    kind: 'asset',
    position: localMetersToCoordinate(
      mesh.city,
      item.center,
      Math.max(10, item.heightM * 0.68)
    ),
    label: item.building.name || 'Mapped building illumination',
    intensity: Math.min(1, Math.max(0.3, item.heightM / 180)),
    properties: {
      sourceFeatureId: item.building.id,
      sourceDataset: 'osm-overpass',
      cityId: mesh.city.id,
      presentationType: 'urban-illumination',
      presentationOnly: true,
      sourceBuildingId: item.building.id,
      buildingHeightM: item.heightM,
      measuredOccupancy: false,
      measuredWindowLights: false
    }
  }));

  return {
    id: `urban-illumination:${mesh.city.id}:${source.eventTime}`,
    layerId: 'illumination',
    ...source,
    nodes,
    edges: []
  };
}

export function cityMeshToSpatialBundle(mesh: CityMeshResponse): CitySpatialBundle {
  return {
    power: cityMeshToPowerOverlay(mesh),
    semantics: cityMeshToSemanticOverlays(mesh),
    illumination: cityMeshToIlluminationOverlay(mesh),
    identity: cityIdentity(mesh)
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
  const source = sourceFields(mesh);
  const eventTime = source.eventTime;

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
        sourceFeatureId: asset.id,
        sourceDataset: 'osm-overpass',
        cityId: mesh.city.id,
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
          sourceFeatureId: line.id,
          sourceLineId: line.id,
          sourceDataset: 'osm-overpass',
          cityId: mesh.city.id,
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
    `/api/aethergrid/geospatial/city/${encodeURIComponent(cityId)}?spatial=1`,
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
    radiusM: '1200',
    spatial: '1'
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
    `/api/aethergrid/geospatial/city/${encodeURIComponent(cityId)}?spatial=1`,
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
