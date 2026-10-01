export interface AtmosphericCurrentState {
  time: string | null;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  relativeHumidityPercent: number | null;
  surfacePressureHpa: number | null;
  weatherCode: number | null;
  cloudCoverPercent: number | null;
  isDay: boolean | null;
  precipitationMm: number | null;
  windSpeedKph: number | null;
  windDirectionDegrees: number | null;
  windGustsKph: number | null;
  shortwaveRadiationWm2: number | null;
  visibilityM: number | null;
}

export interface AtmosphericOverlaySnapshot {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  eventTime: string;
  sourceTime: string | null;
  fetchedAt: string | null;
  live: boolean;
  stale?: boolean;
  fallback: boolean;
  attribution: string | null;
  timezone: string | null;
  utcOffsetSeconds: number;
  current: AtmosphericCurrentState | null;
}

export type WeatherPhenomenon =
  | 'clear'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | 'mixed'
  | 'unavailable';

export function weatherPhenomenon(
  snapshot: AtmosphericOverlaySnapshot | null
): WeatherPhenomenon {
  const current = snapshot?.current;
  if (!current) return 'unavailable';
  const code = Number(current.weatherCode ?? -1);
  if ([45, 48].includes(code)) return 'fog';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return 'rain';
  }
  if (code >= 1 && code <= 3) return 'cloudy';
  if (code === 0) return 'clear';
  return 'mixed';
}


export interface AirQualityOverlaySnapshot {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  eventTime: string;
  sourceTime: string | null;
  fetchedAt: string | null;
  live: boolean;
  fallback: boolean;
  attribution: string | null;
  current: {
    usAqi: number | null;
    category: string;
    pm25UgM3: number | null;
    pm10UgM3: number | null;
    ozoneUgM3: number | null;
    windSpeedKph: number | null;
    windDirectionDegrees: number | null;
  } | null;
}


export interface StormPresentationState {
  active: boolean;
  intensity: number;
  cadenceSeconds: number;
  flashOpacity: number;
}

function bounded(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function stormPresentation(
  snapshot: AtmosphericOverlaySnapshot | null,
  isoTime: string
): StormPresentationState {
  if (!snapshot?.current || weatherPhenomenon(snapshot) !== 'thunderstorm') {
    return {
      active: false,
      intensity: 0,
      cadenceSeconds: 0,
      flashOpacity: 0
    };
  }

  const precipitation = Math.max(0, snapshot.current.precipitationMm ?? 0);
  const gusts = Math.max(
    snapshot.current.windSpeedKph ?? 0,
    snapshot.current.windGustsKph ?? 0
  );
  const intensity = bounded(
    0.25 + bounded(precipitation / 12, 0, 1) * 0.45 + bounded(gusts / 120, 0, 1) * 0.3,
    0.25,
    1
  );
  const cadenceSeconds = Math.round(10 - intensity * 6);
  const timestamp = Date.parse(isoTime);
  if (!Number.isFinite(timestamp)) {
    return {
      active: true,
      intensity,
      cadenceSeconds,
      flashOpacity: 0
    };
  }

  const second = Math.floor(timestamp / 1000);
  const phase = second % cadenceSeconds;
  const flashOpacity =
    phase === 0
      ? 0.12 + intensity * 0.3
      : phase === 1 && intensity >= 0.7
        ? 0.04 + intensity * 0.08
        : 0;

  return {
    active: true,
    intensity,
    cadenceSeconds,
    flashOpacity
  };
}
