import type {
  AtmosphericCurrentState,
  AtmosphericOverlaySnapshot
} from '../renderer/overlays/atmospheric-overlay';
import type {
  OverlayCoordinate,
  SpatialOverlayEdge,
  SpatialOverlaySnapshot
} from '../renderer/overlays/spatial-overlay';

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


function offsetCoordinate(
  origin: AtmosphericOverlaySnapshot['coordinate'],
  eastMeters: number,
  northMeters: number,
  heightMeters = 260
): OverlayCoordinate {
  const latitude = origin.latitude + northMeters / 110_540;
  const metersPerLongitude =
    111_320 * Math.max(0.15, Math.cos((origin.latitude * Math.PI) / 180));
  return {
    latitude,
    longitude: origin.longitude + eastMeters / metersPerLongitude,
    heightMeters
  };
}

export function atmosphereToWindOverlay(
  snapshot: AtmosphericOverlaySnapshot
): SpatialOverlaySnapshot | null {
  const current = snapshot.current;
  if (!current || current.windSpeedKph == null || current.windDirectionDegrees == null) {
    return null;
  }

  const speedKph = Math.max(0, current.windSpeedKph);
  const gustKph = Math.max(speedKph, current.windGustsKph ?? speedKph);
  if (speedKph < 0.5 && gustKph < 1) return null;

  const meteorologicalFrom = current.windDirectionDegrees;
  const towardDegrees = (meteorologicalFrom + 180) % 360;
  const toward = (towardDegrees * Math.PI) / 180;
  const vectorLength = 360 + Math.min(100, speedKph) * 17;
  const arrowLength = Math.max(140, vectorLength * 0.24);
  const intensity = Math.min(1, Math.max(0.08, Math.max(speedKph / 80, gustKph / 120)));
  const edges: SpatialOverlayEdge[] = [];
  const anchors = [-1, 0, 1];

  for (const row of anchors) {
    for (const column of anchors) {
      const baseEast = column * 1_150;
      const baseNorth = row * 1_150;
      const endEast = baseEast + Math.sin(toward) * vectorLength;
      const endNorth = baseNorth + Math.cos(toward) * vectorLength;
      const from = offsetCoordinate(snapshot.coordinate, baseEast, baseNorth);
      const to = offsetCoordinate(snapshot.coordinate, endEast, endNorth, 300);
      const id = `wind:${row + 1}:${column + 1}`;

      const properties = {
        vectorType: 'wind',
        meteorologicalFromDegrees: meteorologicalFrom,
        towardDegrees,
        windSpeedKph: speedKph,
        windGustsKph: gustKph,
        syntheticGeometry: true
      } as const;

      edges.push({
        id,
        kind: 'flow',
        from,
        to,
        label: `Wind ${speedKph.toFixed(1)} km/h`,
        value: speedKph,
        unit: 'km/h',
        intensity,
        properties
      });

      for (const sign of [-1, 1] as const) {
        const headAngle = toward + Math.PI + sign * (Math.PI / 6);
        const head = offsetCoordinate(
          snapshot.coordinate,
          endEast + Math.sin(headAngle) * arrowLength,
          endNorth + Math.cos(headAngle) * arrowLength,
          300
        );
        edges.push({
          id: `${id}:head:${sign}`,
          kind: 'flow',
          from: to,
          to: head,
          label: 'Wind direction',
          value: speedKph,
          unit: 'km/h',
          intensity,
          properties
        });
      }
    }
  }

  return {
    id: `weather-wind:${snapshot.id}`,
    layerId: 'weather',
    eventTime: snapshot.eventTime,
    sourceTime: snapshot.sourceTime,
    fetchedAt: snapshot.fetchedAt,
    live: snapshot.live,
    stale: false,
    fallback: snapshot.fallback,
    attribution: snapshot.attribution,
    nodes: [],
    edges
  };
}
