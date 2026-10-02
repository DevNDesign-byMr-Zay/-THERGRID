import type {
  OverlayCoordinate,
  SpatialOverlayEdge,
  SpatialOverlayNode,
  SpatialOverlaySnapshot
} from '../renderer/overlays/spatial-overlay';

export interface NwsHazardAlert {
  id: string;
  event: string;
  severity: string | null;
  urgency: string | null;
  certainty: string | null;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  effective: string | null;
  onset: string | null;
  expires: string | null;
  areaDesc: string | null;
  affectedZones: readonly string[];
  geometryAvailable: boolean;
}

export interface NwsHazardContext {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  live: boolean;
  stale: boolean;
  fallback: boolean;
  fetchedAt: string;
  attribution: string;
  alerts: readonly NwsHazardAlert[];
  overlay: SpatialOverlaySnapshot;
}

interface ProviderReceiptLike {
  provider?: unknown;
  retrievedAt?: unknown;
  fetchedAt?: unknown;
  live?: unknown;
  stale?: unknown;
  fallback?: unknown;
  attribution?: unknown;
}

const MAX_ALERTS = 24;
const MAX_BOUNDARY_EDGES = 2_000;
const MAX_TEXT = 1_200;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, limit = MAX_TEXT): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return normalized ? normalized.slice(0, limit) : null;
}

function finite(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function coordinate(value: unknown): OverlayCoordinate | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const longitude = finite(value[0]);
  const latitude = finite(value[1]);
  if (
    longitude == null ||
    latitude == null ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }
  return { latitude, longitude, heightMeters: 35 };
}

function severityIntensity(value: unknown): number {
  const severity = String(value ?? '').toLowerCase();
  if (severity === 'extreme') return 1;
  if (severity === 'severe') return 0.82;
  if (severity === 'moderate') return 0.62;
  if (severity === 'minor') return 0.42;
  return 0.5;
}

function alertProperties(
  raw: Record<string, unknown>,
  alert: NwsHazardAlert,
  geometryAvailable: boolean
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    eventType: 'nws-alert',
    alertId: alert.id,
    event: alert.event,
    severity: alert.severity,
    urgency: alert.urgency,
    certainty: alert.certainty,
    headline: alert.headline,
    description: alert.description,
    instruction: alert.instruction,
    areaDesc: alert.areaDesc,
    effective: alert.effective,
    onset: alert.onset,
    expires: alert.expires,
    geometryAvailable,
    appliesAtQueryPoint: true,
    affectedZoneCount: alert.affectedZones.length,
    sourceFeatureId: alert.id,
    sourceGeometryType: text(object(raw.geometry).type, 32)
  });
}

function boundaryEdges(
  alertIndex: number,
  alert: NwsHazardAlert,
  raw: Record<string, unknown>
): SpatialOverlayEdge[] {
  const geometry = object(raw.geometry);
  const geometryType = text(geometry.type, 32);
  const coordinates = geometry.coordinates;
  const polygons: unknown[] =
    geometryType === 'Polygon'
      ? [coordinates]
      : geometryType === 'MultiPolygon' && Array.isArray(coordinates)
        ? coordinates
        : [];

  const edges: SpatialOverlayEdge[] = [];
  for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex += 1) {
    const polygon = polygons[polygonIndex];
    if (!Array.isArray(polygon)) continue;

    for (let ringIndex = 0; ringIndex < polygon.length; ringIndex += 1) {
      const ring = polygon[ringIndex];
      if (!Array.isArray(ring) || ring.length < 2) continue;

      const points = ring
        .map((point) => coordinate(point))
        .filter((point): point is OverlayCoordinate => Boolean(point));
      if (points.length < 2) continue;

      for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
        if (edges.length >= MAX_BOUNDARY_EDGES) return edges;
        edges.push({
          id: `nws:${alertIndex}:p${polygonIndex}:r${ringIndex}:e${pointIndex}`,
          kind: 'impact',
          from: points[pointIndex - 1],
          to: points[pointIndex],
          label: alert.event,
          intensity: severityIntensity(alert.severity),
          validFrom: alert.effective ?? alert.onset,
          validTo: alert.expires,
          properties: {
            ...alertProperties(raw, alert, true),
            eventType: 'nws-alert-boundary',
            boundaryOnly: true,
            ringIndex,
            polygonIndex
          }
        });
      }

      const first = points[0];
      const last = points[points.length - 1];
      const alreadyClosed =
        first.latitude === last.latitude && first.longitude === last.longitude;
      if (!alreadyClosed && edges.length < MAX_BOUNDARY_EDGES) {
        edges.push({
          id: `nws:${alertIndex}:p${polygonIndex}:r${ringIndex}:close`,
          kind: 'impact',
          from: last,
          to: first,
          label: alert.event,
          intensity: severityIntensity(alert.severity),
          validFrom: alert.effective ?? alert.onset,
          validTo: alert.expires,
          properties: {
            ...alertProperties(raw, alert, true),
            eventType: 'nws-alert-boundary',
            boundaryOnly: true,
            ringIndex,
            polygonIndex
          }
        });
      }
    }
  }
  return edges;
}

function parseAlert(
  rawValue: unknown,
  index: number
): { alert: NwsHazardAlert; raw: Record<string, unknown> } {
  const raw = object(rawValue);
  const affectedZones = Array.isArray(raw.affectedZones)
    ? raw.affectedZones
        .map((zone) => text(zone, 300))
        .filter((zone): zone is string => Boolean(zone))
        .slice(0, 64)
    : [];
  const geometry = object(raw.geometry);
  const geometryType = text(geometry.type, 32);
  const geometryAvailable =
    (geometryType === 'Polygon' || geometryType === 'MultiPolygon') &&
    Array.isArray(geometry.coordinates);

  const id =
    text(raw.id, 300) ??
    `nws-alert-${index}-${text(raw.event, 80)?.replace(/[^a-z0-9]+/giu, '-').toLowerCase() || 'unknown'}`;

  return {
    raw,
    alert: {
      id,
      event: text(raw.event, 160) ?? 'NWS ALERT',
      severity: text(raw.severity, 40),
      urgency: text(raw.urgency, 40),
      certainty: text(raw.certainty, 40),
      headline: text(raw.headline, 500),
      description: text(raw.description),
      instruction: text(raw.instruction),
      effective: text(raw.effective, 80),
      onset: text(raw.onset, 80),
      expires: text(raw.expires, 80),
      areaDesc: text(raw.areaDesc ?? raw.affectedArea, 500),
      affectedZones,
      geometryAvailable
    }
  };
}

export async function loadNwsHazards(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<NwsHazardContext> {
  const query = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude)
  });
  const response = await fetch(
    `/api/aethergrid/hazards/alerts?${query.toString()}`,
    {
      headers: { accept: 'application/json' },
      signal
    }
  );
  if (!response.ok) {
    throw new Error(`NWS hazards request failed with HTTP ${response.status}`);
  }

  const payload = object(await response.json().catch(() => ({})));
  const receipt = object(payload.receipt) as ProviderReceiptLike;
  const data = object(payload.data ?? payload);
  const fetchedAt =
    text(receipt.retrievedAt, 80) ??
    text(receipt.fetchedAt, 80) ??
    new Date().toISOString();
  const attribution =
    text(receipt.attribution, 300) ??
    'US National Weather Service (api.weather.gov)';
  const live = receipt.live === true || data.live === true;
  const stale = receipt.stale === true;
  const fallback = receipt.fallback === true || !live;

  const parsed = (Array.isArray(data.alerts) ? data.alerts : [])
    .slice(0, MAX_ALERTS)
    .map((value, index) => parseAlert(value, index));

  const nodes: SpatialOverlayNode[] = parsed.map(({ alert, raw }, index) => ({
    id: `nws-alert-node:${alert.id}`,
    kind: 'event',
    position: { latitude, longitude, heightMeters: 80 + index * 8 },
    label: alert.event,
    intensity: severityIntensity(alert.severity),
    validFrom: alert.effective ?? alert.onset,
    validTo: alert.expires,
    properties: alertProperties(raw, alert, alert.geometryAvailable)
  }));

  const edges: SpatialOverlayEdge[] = [];
  for (let index = 0; index < parsed.length; index += 1) {
    if (edges.length >= MAX_BOUNDARY_EDGES) break;
    const item = parsed[index];
    const remaining = MAX_BOUNDARY_EDGES - edges.length;
    edges.push(...boundaryEdges(index, item.alert, item.raw).slice(0, remaining));
  }

  const overlay: SpatialOverlaySnapshot = {
    id: `nws-hazards:${latitude.toFixed(5)}:${longitude.toFixed(5)}:${fetchedAt}`,
    layerId: 'hazards',
    eventTime: fetchedAt,
    sourceTime: null,
    fetchedAt,
    live,
    stale,
    fallback,
    attribution,
    nodes,
    edges,
    areas: []
  };

  return {
    coordinate: { latitude, longitude },
    live,
    stale,
    fallback,
    fetchedAt,
    attribution,
    alerts: parsed.map(({ alert }) => alert),
    overlay
  };
}
