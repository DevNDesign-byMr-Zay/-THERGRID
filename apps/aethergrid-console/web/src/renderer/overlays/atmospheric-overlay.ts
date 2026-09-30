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
