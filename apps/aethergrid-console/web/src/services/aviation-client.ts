import type {
  AircraftTruthState,
  AviationAircraft,
  AviationProviderSnapshot,
  AviationRelationship
} from '../domains/aviation/aviation-domain';

type JsonRecord = Record<string, unknown>;

export interface AviationQuery {
  scope: 'global' | 'city';
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finite(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function truthState(value: unknown, stale: boolean): AircraftTruthState {
  if (stale) return 'stale';
  return value === 'interpolated' || value === 'predicted' || value === 'stale'
    ? value
    : 'observed';
}

function aircraftFromRow(value: unknown, stale: boolean): AviationAircraft | null {
  const row = record(value);
  const latitude = finite(row.latitude ?? row.lat);
  const longitude = finite(row.longitude ?? row.lon);
  const observedAt =
    text(row.observedAt ?? row.observed_at ?? row.timestamp) ?? null;
  if (latitude == null || longitude == null || !observedAt) return null;

  const icaoHex = text(row.icaoHex ?? row.icao_hex ?? row.hex);
  const registration = text(row.registration ?? row.reg);
  const id =
    text(row.id ?? row.aircraftId ?? row.aircraft_id) ??
    icaoHex ??
    registration;
  if (!id) return null;

  return {
    id,
    icaoHex,
    callsign: text(row.callsign ?? row.callSign),
    operator: text(row.operator ?? row.airline),
    flightNumber: text(row.flightNumber ?? row.flight_number),
    registration,
    aircraftType: text(row.aircraftType ?? row.aircraft_type ?? row.type),
    latitude,
    longitude,
    barometricAltitudeMeters: finite(
      row.barometricAltitudeMeters ?? row.barometric_altitude_meters
    ),
    geometricAltitudeMeters: finite(
      row.geometricAltitudeMeters ?? row.geometric_altitude_meters
    ),
    groundSpeedKnots: finite(row.groundSpeedKnots ?? row.ground_speed_knots),
    trackDegrees: finite(row.trackDegrees ?? row.track_degrees ?? row.heading),
    verticalRateFpm: finite(row.verticalRateFpm ?? row.vertical_rate_fpm),
    squawk: text(row.squawk),
    onGround: row.onGround === true || row.on_ground === true,
    observedAt,
    truthState: truthState(row.truthState ?? row.truth_state, stale)
  };
}

function coordinate(value: unknown) {
  const source = record(value);
  const latitude = finite(source.latitude ?? source.lat);
  const longitude = finite(source.longitude ?? source.lon);
  if (latitude == null || longitude == null) return null;
  return {
    latitude,
    longitude,
    heightMeters: finite(source.heightMeters ?? source.height_meters) ?? undefined
  };
}

function relationshipFromRow(value: unknown): AviationRelationship | null {
  const row = record(value);
  const from = coordinate(row.from);
  const to = coordinate(row.to);
  if (!from || !to) return null;
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    from,
    to,
    label: text(row.label),
    sourceBacked: row.sourceBacked === true || row.source_backed === true,
    source: text(row.source)
  };
}

export async function loadAviationSnapshot(
  query: AviationQuery,
  signal?: AbortSignal
): Promise<AviationProviderSnapshot> {
  const params = new URLSearchParams({ scope: query.scope });
  if (query.scope === 'city') {
    if (Number.isFinite(query.latitude)) {
      params.set('latitude', String(query.latitude));
    }
    if (Number.isFinite(query.longitude)) {
      params.set('longitude', String(query.longitude));
    }
    if (Number.isFinite(query.radiusKm)) {
      params.set('radiusKm', String(query.radiusKm));
    }
  }

  const response = await fetch(
    `/api/aethergrid/domains/aviation/aircraft?${params.toString()}`,
    {
      headers: { Accept: 'application/json' },
      signal
    }
  );
  const payload = record(await response.json().catch(() => ({})));
  if (!response.ok) {
    const detail =
      text(payload.error ?? payload.message) ??
      `Aviation provider request failed with HTTP ${response.status}`;
    throw new Error(detail);
  }

  const data = record(payload.data ?? payload);
  const receipt = record(payload.receipt);
  const stale = receipt.stale === true || data.stale === true;
  const rows = Array.isArray(data.aircraft) ? data.aircraft : [];
  const relationships = Array.isArray(data.relationships)
    ? data.relationships
    : [];

  return {
    provider:
      text(receipt.provider ?? data.provider) ?? 'aviation-provider',
    sourceTime: text(
      receipt.sourceTime ??
        receipt.observedAt ??
        data.sourceTime ??
        data.source_time
    ),
    fetchedAt:
      text(receipt.fetchedAt ?? data.fetchedAt ?? data.fetched_at) ??
      new Date().toISOString(),
    live: receipt.live === true || data.live === true,
    stale,
    fallback: receipt.fallback === true || data.fallback === true,
    attribution: text(receipt.attribution ?? data.attribution),
    aircraft: rows
      .map((row) => aircraftFromRow(row, stale))
      .filter((row): row is AviationAircraft => Boolean(row)),
    relationships: relationships
      .map(relationshipFromRow)
      .filter((row): row is AviationRelationship => Boolean(row))
  };
}
