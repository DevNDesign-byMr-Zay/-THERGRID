import type {
  SpatialOverlayNode,
  SpatialOverlaySnapshot
} from '../renderer/overlays/spatial-overlay';

interface ReceiptLike {
  provider?: unknown;
  dataset?: unknown;
  retrievedAt?: unknown;
  live?: unknown;
  stale?: unknown;
  fallback?: unknown;
  attribution?: unknown;
}

export interface NoaaHydrologyGauge {
  gaugeId: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  observedStageFeet: number | null;
  observedFlowCfs: number | null;
  observedAt: string | null;
  actionStageFeet: number | null;
  minorFloodStageFeet: number | null;
  moderateFloodStageFeet: number | null;
  majorFloodStageFeet: number | null;
  forecastStageFeet: number | null;
  forecastAt: string | null;
  status: string | null;
}

export interface NoaaHydrologyContext {
  gauge: NoaaHydrologyGauge;
  provider: string;
  dataset: string | null;
  sourceTime: string | null;
  fetchedAt: string | null;
  attribution: string;
  live: boolean;
  stale: boolean;
  fallback: boolean;
  partial: boolean;
  overlay: SpatialOverlaySnapshot;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finite(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

function floodBand(
  stage: number | null,
  gauge: Pick<
    NoaaHydrologyGauge,
    | 'actionStageFeet'
    | 'minorFloodStageFeet'
    | 'moderateFloodStageFeet'
    | 'majorFloodStageFeet'
  >
): string {
  if (stage == null || [gauge.actionStageFeet, gauge.minorFloodStageFeet, gauge.moderateFloodStageFeet, gauge.majorFloodStageFeet].every((value) => value == null)) return 'unknown';
  if (gauge.majorFloodStageFeet != null && stage >= gauge.majorFloodStageFeet) {
    return 'major';
  }
  if (
    gauge.moderateFloodStageFeet != null &&
    stage >= gauge.moderateFloodStageFeet
  ) {
    return 'moderate';
  }
  if (gauge.minorFloodStageFeet != null && stage >= gauge.minorFloodStageFeet) {
    return 'minor';
  }
  if (gauge.actionStageFeet != null && stage >= gauge.actionStageFeet) {
    return 'action';
  }
  return 'below-action';
}

export async function loadNoaaHydrologyContext(
  gaugeId: string,
  signal?: AbortSignal
): Promise<NoaaHydrologyContext> {
  const cleanGaugeId = gaugeId.trim().toUpperCase();
  if (!cleanGaugeId) {
    throw new Error('An explicit NOAA NWPS gauge ID is required.');
  }

  const query = new URLSearchParams({ gaugeId: cleanGaugeId });
  const response = await fetch(
    `/api/aethergrid/hydrology/gauges?${query.toString()}`,
    {
      headers: { accept: 'application/json' },
      signal
    }
  );
  const payload = object(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(
      text(payload.message) ??
        text(payload.error) ??
        `hydrology request failed with HTTP ${response.status}`
    );
  }

  const data = object(payload.data ?? payload);
  const receipt = object(payload.receipt) as ReceiptLike;
  const gauge: NoaaHydrologyGauge = {
    gaugeId: text(data.gaugeId) ?? cleanGaugeId,
    name: text(data.name),
    latitude: finite(data.latitude),
    longitude: finite(data.longitude),
    observedStageFeet: finite(data.observedStageFeet),
    observedFlowCfs: finite(data.observedFlowCfs) === -999 ? null : finite(data.observedFlowCfs),
    observedAt: text(data.observedAt),
    actionStageFeet: finite(data.actionStageFeet),
    minorFloodStageFeet: finite(data.minorFloodStageFeet),
    moderateFloodStageFeet: finite(data.moderateFloodStageFeet),
    majorFloodStageFeet: finite(data.majorFloodStageFeet),
    forecastStageFeet: finite(data.forecastStageFeet),
    forecastAt: text(data.forecastAt),
    status: text(data.status)
  };

  const live = receipt.live === true || data.live === true;
  const stale = receipt.stale === true;
  const fallback = receipt.fallback === true || !live;
  const partial = gauge.status?.includes('Partial') === true;
  const fetchedAt = text(receipt.retrievedAt);
  const sourceTime = gauge.observedAt ?? gauge.forecastAt ?? fetchedAt;
  const attribution =
    text(receipt.attribution) ??
    'NOAA National Water Prediction Service (NWPS)';
  const band = floodBand(gauge.observedStageFeet, gauge);

  const nodes: SpatialOverlayNode[] =
    (live || stale) &&
    validCoordinate(gauge.latitude, gauge.longitude)
      ? [
          {
            id: `noaa-nwps:${gauge.gaugeId}`,
            kind: 'sensor',
            position: {
              latitude: gauge.latitude as number,
              longitude: gauge.longitude as number,
              heightMeters: 3
            },
            label: gauge.name ?? gauge.gaugeId,
            value: gauge.observedStageFeet,
            unit: gauge.observedStageFeet == null ? null : 'ft',
            intensity:
              band === 'major'
                ? 1
                : band === 'moderate'
                  ? 0.9
                  : band === 'minor'
                    ? 0.78
                    : band === 'action'
                      ? 0.65
                      : 0.5,
            properties: {
              eventType: 'noaa-nwps-gauge',
              sourceBacked: true,
              gaugeId: gauge.gaugeId,
              name: gauge.name,
              observedStageFeet: gauge.observedStageFeet,
              observedFlowCfs: gauge.observedFlowCfs,
              observedAt: gauge.observedAt,
              forecastStageFeet: gauge.forecastStageFeet,
              forecastAt: gauge.forecastAt,
              actionStageFeet: gauge.actionStageFeet,
              minorFloodStageFeet: gauge.minorFloodStageFeet,
              moderateFloodStageFeet: gauge.moderateFloodStageFeet,
              majorFloodStageFeet: gauge.majorFloodStageFeet,
              floodBand: band,
              partial
            }
          }
        ]
      : [];

  return {
    gauge,
    provider: text(receipt.provider) ?? 'noaa-nwps',
    dataset: text(receipt.dataset),
    sourceTime,
    fetchedAt,
    attribution,
    live,
    stale,
    fallback,
    partial,
    overlay: {
      id: `hydrology:${gauge.gaugeId}:${sourceTime ?? fetchedAt ?? 'unknown'}`,
      layerId: 'hydrology',
      eventTime: sourceTime ?? fetchedAt ?? new Date().toISOString(),
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
