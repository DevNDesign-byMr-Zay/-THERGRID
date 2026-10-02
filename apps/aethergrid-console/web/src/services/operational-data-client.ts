import type { TemporalMode } from '../renderer/spatial-renderer';
import type { OperationalSourceId } from '../time/operational-temporal-capabilities';

export type OperationalSourceState =
  | 'live'
  | 'forecast'
  | 'stale'
  | 'fallback'
  | 'unconfigured'
  | 'unavailable';

export interface OperationalFuelMixRow {
  period: string | null;
  respondent: string | null;
  fuelType: string | null;
  fuelTypeDescription: string | null;
  value: number | null;
  sourceUnits: string | null;
}

export interface OperationalSourceSnapshot {
  id: OperationalSourceId;
  state: OperationalSourceState;
  provider: string | null;
  dataset: string | null;
  sourceTime: string | null;
  fetchedAt: string | null;
  attribution: string | null;
  summary: string;
  metrics: readonly { label: string; value: string }[];
  fuelMix?: readonly OperationalFuelMixRow[];
  error: string | null;
}

export interface OperationalSnapshot {
  coordinate: { latitude: number; longitude: number };
  temporalMode: TemporalMode;
  cursorIso: string;
  fetchedAt: string;
  sources: readonly OperationalSourceSnapshot[];
}

interface ProviderReceiptLike {
  provider?: unknown;
  dataset?: unknown;
  observedAt?: unknown;
  modelRunAt?: unknown;
  retrievedAt?: unknown;
  fetchedAt?: unknown;
  attribution?: unknown;
  live?: unknown;
  stale?: unknown;
  fallback?: unknown;
}

function finite(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function receiptFrom(payload: Record<string, unknown>): ProviderReceiptLike {
  return object(payload.receipt ?? payload.providerReceipt) as ProviderReceiptLike;
}

function stateFrom(
  payload: Record<string, unknown>,
  receipt: ProviderReceiptLike
): OperationalSourceState {
  const nested = object(payload.data);
  const status =
    (text(payload.status) ?? text(nested.status))?.toLowerCase() ?? null;
  if (status === 'unconfigured' || status?.includes('unconfigured')) {
    return 'unconfigured';
  }
  if (
    status === 'unavailable' ||
    status === 'invalid_region' ||
    status === 'missing_coordinates'
  ) {
    return 'unavailable';
  }
  if (receipt.stale === true) return 'stale';
  if (receipt.fallback === true || receipt.live === false) return 'fallback';
  if (receipt.live === true || payload.live === true) return 'live';
  return 'unavailable';
}

async function fetchJson(
  url: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; status: number; payload: Record<string, unknown> }> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal
  });
  const payload = object(await response.json().catch(() => ({})));
  return { ok: response.ok, status: response.status, payload };
}

function unavailable(
  id: OperationalSourceId,
  message: string,
  state: OperationalSourceState = 'unavailable'
): OperationalSourceSnapshot {
  return {
    id,
    state,
    provider: null,
    dataset: null,
    sourceTime: null,
    fetchedAt: null,
    attribution: null,
    summary: message,
    metrics: [],
    error: message
  };
}

function normalizeCommon(
  id: OperationalSourceId,
  payload: Record<string, unknown>,
  summary: string,
  metrics: readonly { label: string; value: string }[]
): OperationalSourceSnapshot {
  const receipt = receiptFrom(payload);
  const state = stateFrom(payload, receipt);
  const sourceBackedMetrics = state === 'live' || state === 'stale' ? metrics : [];
  return {
    id,
    state,
    provider: text(receipt.provider) ?? text(payload.provider),
    dataset: text(receipt.dataset),
    sourceTime:
      text(receipt.observedAt) ??
      text(receipt.modelRunAt) ??
      text(payload.observedAt) ??
      text(payload.sourceTime),
    fetchedAt:
      text(receipt.retrievedAt) ??
      text(receipt.fetchedAt) ??
      text(payload.fetchedAt),
    attribution: text(receipt.attribution) ?? text(payload.attribution),
    summary:
      state === 'fallback'
        ? 'Fallback response present; operational metrics withheld until a source-backed receipt is available.'
        : summary,
    metrics: sourceBackedMetrics,
    error: text(payload.error)
  };
}

async function weatherSource(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<OperationalSourceSnapshot> {
  const query = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
  const result = await fetchJson(`/api/aethergrid/weather/current?${query.toString()}`, signal);
  if (!result.ok) return unavailable('weather', `Weather endpoint unavailable (HTTP ${result.status}).`);

  const data = object(result.payload.data ?? result.payload);
  const temperature = finite(data.temperatureC ?? data.temperature);
  const humidity = finite(data.humidityPercent ?? data.humidity);
  const wind = finite(data.windSpeedKmh ?? data.windSpeedKph);
  const metrics = [
    temperature == null ? null : { label: 'TEMP', value: `${temperature.toFixed(1)}°C` },
    humidity == null ? null : { label: 'HUMIDITY', value: `${humidity.toFixed(0)}%` },
    wind == null ? null : { label: 'WIND', value: `${wind.toFixed(1)} km/h` }
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return normalizeCommon(
    'weather',
    result.payload,
    text(data.condition) ?? 'Provider-backed current weather',
    metrics
  );
}

async function hazardSource(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<OperationalSourceSnapshot> {
  const query = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
  const result = await fetchJson(`/api/aethergrid/hazards/alerts?${query.toString()}`, signal);
  if (!result.ok) return unavailable('hazards', `Hazards endpoint unavailable (HTTP ${result.status}).`);
  const data = object(result.payload.data ?? result.payload);
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];
  return normalizeCommon(
    'hazards',
    result.payload,
    alerts.length ? `${alerts.length} active source-backed alert${alerts.length === 1 ? '' : 's'}` : 'No active alerts returned by the provider',
    [{ label: 'ACTIVE', value: String(alerts.length) }]
  );
}

export async function loadHydrologyGauge(
  gaugeId: string,
  signal?: AbortSignal
): Promise<OperationalSourceSnapshot> {
  if (!gaugeId.trim()) {
    return unavailable('hydrology', 'A source-backed gauge identifier is required.', 'unconfigured');
  }
  const query = new URLSearchParams({ gaugeId });
  const result = await fetchJson(`/api/aethergrid/hydrology/gauges?${query.toString()}`, signal);
  if (!result.ok) return unavailable('hydrology', `Hydrology endpoint unavailable (HTTP ${result.status}).`);
  const data = object(result.payload.data ?? result.payload);
  const stage = finite(data.observedStageFeet);
  const flow = finite(data.observedFlowCfs);
  const forecastStage = finite(data.forecastStageFeet);
  const minorFloodStage = finite(data.minorFloodStageFeet);
  const returnedGaugeId = text(data.gaugeId);
  const metrics = [
    returnedGaugeId ? { label: 'GAUGE', value: returnedGaugeId } : null,
    stage == null ? null : { label: 'STAGE', value: `${stage.toFixed(2)} ft` },
    flow == null ? null : { label: 'FLOW', value: `${flow.toFixed(0)} cfs` },
    forecastStage == null
      ? null
      : { label: 'FCST STAGE', value: `${forecastStage.toFixed(2)} ft` },
    minorFloodStage == null
      ? null
      : { label: 'MINOR FLOOD', value: `${minorFloodStage.toFixed(2)} ft` }
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  return normalizeCommon(
    'hydrology',
    {
      ...result.payload,
      observedAt: text(data.observedAt),
      sourceTime: text(data.observedAt) ?? text(data.forecastAt)
    },
    text(data.name) ?? 'Provider-backed NOAA gauge context',
    metrics
  );
}

export async function loadEnergyContextForRegion(
  region: string,
  signal?: AbortSignal
): Promise<OperationalSourceSnapshot> {
  if (!region.trim()) {
    return unavailable('energy', 'A source-backed energy region is required.', 'unconfigured');
  }
  const query = new URLSearchParams({ region });
  const result = await fetchJson(`/api/aethergrid/energy/context?${query.toString()}`, signal);
  if (!result.ok) return unavailable('energy', `Energy endpoint unavailable (HTTP ${result.status}).`);
  const data = object(result.payload.data ?? result.payload);
  const rawFuelMix = Array.isArray(data.fuelMix) ? data.fuelMix : [];
  const fuelMix: OperationalFuelMixRow[] = rawFuelMix.map((row) => {
    const record = object(row);
    return {
      period: text(record.period),
      respondent: text(record.respondent),
      fuelType: text(record.fueltype),
      fuelTypeDescription: text(
        record.fueltypeDescription ?? record.fueltype
      ),
      value: finite(record.value),
      sourceUnits: text(record.sourceUnits)
    };
  });
  const returnedRegion = text(data.region);
  const periods = fuelMix
    .map((row) => row.period)
    .filter((value): value is string => Boolean(value));
  const newestPeriod = periods.length ? periods[0] : null;
  const metrics = [
    returnedRegion ? { label: 'REGION', value: returnedRegion } : null,
    { label: 'FUEL ROWS', value: String(fuelMix.length) },
    newestPeriod ? { label: 'LATEST', value: newestPeriod } : null
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  return {
    ...normalizeCommon(
      'energy',
      {
        ...result.payload,
        sourceTime: newestPeriod
      },
      returnedRegion
        ? `EIA hourly fuel-type records for ${returnedRegion}`
        : 'Provider-backed regional energy context',
      metrics
    ),
    fuelMix
  };
}

async function transitSource(cityId: string, signal?: AbortSignal): Promise<OperationalSourceSnapshot> {
  const query = new URLSearchParams({ cityId });
  const result = await fetchJson(`/api/aethergrid/transit/vehicles?${query.toString()}`, signal);
  if (!result.ok) return unavailable('transit', `Transit endpoint unavailable (HTTP ${result.status}).`);
  const data = object(result.payload.data ?? result.payload);
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
  const receipt = receiptFrom(result.payload);
  const status = text(data.status);
  const configured =
    receipt.live === true ||
    data.live === true ||
    status === 'GTFS-Realtime Live';
  const feedTimestamp = finite(data.feedHeaderTimestamp);
  return normalizeCommon(
    'transit',
    {
      ...result.payload,
      sourceTime:
        feedTimestamp == null
          ? null
          : new Date(feedTimestamp * 1000).toISOString()
    },
    configured
      ? `${vehicles.length} decoded vehicle position${vehicles.length === 1 ? '' : 's'}`
      : text(data.message) ?? 'Transit provider is not configured',
    [{ label: 'VEHICLES', value: String(vehicles.length) }]
  );
}

export async function loadOperationalSnapshot(input: {
  latitude: number;
  longitude: number;
  cityId: string;
  temporalMode: TemporalMode;
  cursorIso: string;
  gaugeId?: string | null;
  energyRegion?: string | null;
  signal?: AbortSignal;
}): Promise<OperationalSnapshot> {
  const fetchedAt = new Date().toISOString();

  if (input.temporalMode !== 'live') {
    return {
      coordinate: { latitude: input.latitude, longitude: input.longitude },
      temporalMode: input.temporalMode,
      cursorIso: input.cursorIso,
      fetchedAt,
      sources: [
        unavailable('weather', 'No provider-backed sample is connected to this non-LIVE cursor.'),
        unavailable('hazards', 'No provider-backed sample is connected to this non-LIVE cursor.'),
        unavailable('hydrology', 'No provider-backed sample is connected to this non-LIVE cursor.'),
        unavailable('energy', 'No provider-backed sample is connected to this non-LIVE cursor.'),
        unavailable('transit', 'No provider-backed sample is connected to this non-LIVE cursor.')
      ]
    };
  }

  const settled = await Promise.allSettled([
    weatherSource(input.latitude, input.longitude, input.signal),
    hazardSource(input.latitude, input.longitude, input.signal),
    transitSource(input.cityId, input.signal),
    input.gaugeId
      ? loadHydrologyGauge(input.gaugeId, input.signal)
      : Promise.resolve(
          unavailable(
            'hydrology',
            'Bind an explicit NOAA NWPS gauge ID to this city or coordinate to load live hydrology.',
            'unconfigured'
          )
        ),
    input.energyRegion
      ? loadEnergyContextForRegion(input.energyRegion, input.signal)
      : Promise.resolve(
          unavailable(
            'energy',
            'Bind an explicit EIA balancing-region code to this city or coordinate to load live energy context.',
            'unconfigured'
          )
        )
  ]);

  const ids: readonly OperationalSourceId[] = [
    'weather',
    'hazards',
    'transit',
    'hydrology',
    'energy'
  ];
  const resolved = settled.map((result, index) =>
    result.status === 'fulfilled'
      ? result.value
      : unavailable(
          ids[index],
          result.reason instanceof Error ? result.reason.message : String(result.reason)
        )
  );

  const byId = new Map(resolved.map((source) => [source.id, source]));
  const sources: readonly OperationalSourceSnapshot[] = [
    byId.get('weather') ?? unavailable('weather', 'Weather source unavailable.'),
    byId.get('hazards') ?? unavailable('hazards', 'Hazards source unavailable.'),
    byId.get('hydrology') ??
      unavailable('hydrology', 'Hydrology source unavailable.'),
    byId.get('energy') ?? unavailable('energy', 'Energy source unavailable.'),
    byId.get('transit') ?? unavailable('transit', 'Transit source unavailable.')
  ];

  return {
    coordinate: { latitude: input.latitude, longitude: input.longitude },
    temporalMode: input.temporalMode,
    cursorIso: input.cursorIso,
    fetchedAt,
    sources
  };
}
