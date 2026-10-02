import type {
  SpatialOverlayNode,
  SpatialOverlaySnapshot
} from '../renderer/overlays/spatial-overlay';

interface ProviderReceiptLike {
  provider?: unknown;
  dataset?: unknown;
  retrievedAt?: unknown;
  observedAt?: unknown;
  live?: unknown;
  stale?: unknown;
  fallback?: unknown;
  attribution?: unknown;
}

export interface GtfsTransitVehicle {
  id: string;
  agencyId: string | null;
  vehicleId: string | null;
  tripId: string | null;
  routeId: string | null;
  latitude: number;
  longitude: number;
  bearing: number | null;
  speedMps: number | null;
  stopId: string | null;
  timestamp: string | null;
}

export interface GtfsTransitContext {
  cityId: string;
  agencyName: string | null;
  provider: string | null;
  dataset: string | null;
  sourceTime: string | null;
  fetchedAt: string | null;
  attribution: string | null;
  live: boolean;
  stale: boolean;
  fallback: boolean;
  unconfigured: boolean;
  status: string | null;
  vehicles: readonly GtfsTransitVehicle[];
  overlay: SpatialOverlaySnapshot;
}

const MAX_TRANSIT_VEHICLES = 2_000;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finite(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function epochSecondsToIso(value: unknown): string | null {
  const seconds = finite(value);
  if (seconds == null || seconds <= 0) return null;
  const milliseconds = seconds * 1000;
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : null;
}

function validCoordinate(latitude: number | null, longitude: number | null): boolean {
  return (
    latitude != null &&
    longitude != null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export async function loadGtfsTransit(
  cityId: string,
  signal?: AbortSignal
): Promise<GtfsTransitContext> {
  const query = new URLSearchParams({ cityId });
  const response = await fetch(
    `/api/aethergrid/transit/vehicles?${query.toString()}`,
    {
      headers: { accept: 'application/json' },
      signal
    }
  );
  const payload = object(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(
      text(payload.error) ??
        `transit request failed with HTTP ${response.status}`
    );
  }

  const data = object(payload.data ?? payload);
  const receipt = object(payload.receipt) as ProviderReceiptLike;
  const status = text(data.status);
  const stale = receipt.stale === true || data.stale === true;
  const live =
    (receipt.live === true || data.live === true || status === 'GTFS-Realtime Live') &&
    !stale;
  const unconfigured =
    status === 'unconfigured' ||
    status?.toLowerCase().includes('unconfigured') === true ||
    status?.toLowerCase().includes('not configured') === true;
  const fallback = receipt.fallback === true || (!live && !stale);
  const fetchedAt =
    text(receipt.retrievedAt) ??
    text(data.retrievedAt) ??
    new Date().toISOString();
  const sourceTime =
    epochSecondsToIso(data.feedHeaderTimestamp) ??
    text(receipt.observedAt) ??
    fetchedAt;
  const provider = text(receipt.provider) ?? 'gtfs-rt-registry';
  const attribution =
    text(receipt.attribution) ??
    text(data.agencyName) ??
    'GTFS-Realtime';
  const sourceBacked = live || stale;

  const vehicles = (Array.isArray(data.vehicles) ? data.vehicles : [])
    .slice(0, MAX_TRANSIT_VEHICLES)
    .map((item, index): GtfsTransitVehicle | null => {
      const row = object(item);
      const latitude = finite(row.latitude);
      const longitude = finite(row.longitude);
      if (!validCoordinate(latitude, longitude)) return null;
      const timestamp = epochSecondsToIso(row.timestamp);
      return {
        id:
          text(row.entityId) ??
          text(row.vehicleId) ??
          `vehicle-${index + 1}`,
        agencyId: text(row.agencyId),
        vehicleId: text(row.vehicleId),
        tripId: text(row.tripId),
        routeId: text(row.routeId),
        latitude: latitude as number,
        longitude: longitude as number,
        bearing: finite(row.bearing),
        speedMps: finite(row.speed),
        stopId: text(row.stopId),
        timestamp
      };
    })
    .filter((item): item is GtfsTransitVehicle => Boolean(item));

  const nodes: SpatialOverlayNode[] = sourceBacked
    ? vehicles.map((vehicle) => ({
        id: `gtfs:${cityId}:${vehicle.id}`,
        kind: 'transit',
        position: {
          latitude: vehicle.latitude,
          longitude: vehicle.longitude,
          heightMeters: 8
        },
        label:
          vehicle.routeId ??
          vehicle.vehicleId ??
          vehicle.id,
        value: vehicle.speedMps,
        unit: vehicle.speedMps == null ? null : 'm/s',
        intensity:
          vehicle.speedMps == null
            ? 0.62
            : Math.min(1, Math.max(0.35, vehicle.speedMps / 22)),
        properties: {
          eventType: 'gtfs-vehicle',
          sourceBacked: true,
          cityId,
          agencyId: vehicle.agencyId,
          vehicleId: vehicle.vehicleId,
          tripId: vehicle.tripId,
          routeId: vehicle.routeId,
          bearing: vehicle.bearing,
          speedMps: vehicle.speedMps,
          stopId: vehicle.stopId,
          vehicleTimestamp: vehicle.timestamp
        }
      }))
    : [];

  return {
    cityId,
    agencyName: text(data.agencyName),
    provider,
    dataset: text(receipt.dataset),
    sourceTime,
    fetchedAt,
    attribution,
    live,
    stale,
    fallback,
    unconfigured,
    status,
    vehicles,
    overlay: {
      id: `gtfs-transit:${cityId}:${sourceTime ?? fetchedAt}`,
      layerId: 'transit',
      eventTime: sourceTime ?? fetchedAt,
      sourceTime,
      fetchedAt,
      live,
      stale,
      fallback,
      attribution,
      nodes,
      edges: []
    }
  };
}
