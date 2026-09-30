import type {
  AtmosphericCurrentState,
  AtmosphericOverlaySnapshot
} from '../renderer/overlays/atmospheric-overlay';

interface EnvironmentResponse {
  coordinate?: {
    lat?: number;
    lon?: number;
  };
  source?: {
    provider?: string;
    live?: boolean;
    attribution?: string | null;
    fetchedAt?: string | null;
    modelTime?: string | null;
  };
  timezone?: string | null;
  utcOffsetSeconds?: number;
  current?: Partial<AtmosphericCurrentState> | null;
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function modelTimeToIso(value: string | null | undefined, utcOffsetSeconds: number): string | null {
  if (!value) return null;
  if (/Z$|[+-]\d\d:\d\d$/u.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  const asUtc = Date.parse(`${value}Z`);
  if (!Number.isFinite(asUtc)) return null;
  return new Date(asUtc - utcOffsetSeconds * 1000).toISOString();
}

export async function loadCityEnvironment(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<AtmosphericOverlaySnapshot> {
  const query = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude)
  });
  const response = await fetch(`/api/aethergrid/environment?${query.toString()}`, {
    headers: { accept: 'application/json' },
    signal
  });
  if (!response.ok) {
    throw new Error(`city environment request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as EnvironmentResponse;
  const source = payload.source ?? {};
  const current = payload.current;
  const fetchedAt = source.fetchedAt ?? new Date().toISOString();
  const utcOffsetSeconds = finiteOrNull(payload.utcOffsetSeconds) ?? 0;
  const sourceTime = modelTimeToIso(source.modelTime ?? current?.time, utcOffsetSeconds);

  return {
    id: `environment:${latitude.toFixed(5)}:${longitude.toFixed(5)}:${fetchedAt}`,
    coordinate: {
      latitude: finiteOrNull(payload.coordinate?.lat) ?? latitude,
      longitude: finiteOrNull(payload.coordinate?.lon) ?? longitude
    },
    eventTime: sourceTime ?? fetchedAt,
    sourceTime,
    fetchedAt,
    live: source.live === true,
    fallback: source.live !== true,
    attribution: source.attribution ?? source.provider ?? null,
    timezone: payload.timezone ?? null,
    utcOffsetSeconds,
    current: current
      ? {
          time: current.time ?? null,
          temperatureC: finiteOrNull(current.temperatureC),
          apparentTemperatureC: finiteOrNull(current.apparentTemperatureC),
          relativeHumidityPercent: finiteOrNull(current.relativeHumidityPercent),
          surfacePressureHpa: finiteOrNull(current.surfacePressureHpa),
          weatherCode: finiteOrNull(current.weatherCode),
          cloudCoverPercent: finiteOrNull(current.cloudCoverPercent),
          isDay: typeof current.isDay === 'boolean' ? current.isDay : null,
          precipitationMm: finiteOrNull(current.precipitationMm),
          windSpeedKph: finiteOrNull(current.windSpeedKph),
          windDirectionDegrees: finiteOrNull(current.windDirectionDegrees),
          windGustsKph: finiteOrNull(current.windGustsKph),
          shortwaveRadiationWm2: finiteOrNull(current.shortwaveRadiationWm2),
          visibilityM: finiteOrNull(current.visibilityM)
        }
      : null
  };
}
