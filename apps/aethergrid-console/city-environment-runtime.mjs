const DEFAULT_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

function validateCoordinate(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error(`${label} must be between ${min} and ${max}`);
    error.status = 400;
    throw error;
  }
  return number;
}

function validateEndpoint(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('environment URL must be HTTP(S)');
  return url;
}

function localFallback(lat, lon, error = null) {
  return {
    schemaVersion: 1,
    coordinate: { lat, lon },
    source: {
      provider: 'local-environment-fallback',
      live: false,
      attribution: null,
      fetchedAt: new Date().toISOString(),
      error: error ? (error instanceof Error ? error.message : String(error)) : null,
    },
    current: null,
  };
}

export function createCityEnvironmentRuntime({
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const provider = String(env.AETHERGRID_ENVIRONMENT_PROVIDER || 'open-meteo').toLowerCase();
  const endpoint = String(env.AETHERGRID_OPEN_METEO_URL || DEFAULT_ENDPOINT);

  function summary() {
    return {
      provider,
      liveProviderConfigured: provider === 'open-meteo',
      endpoint: provider === 'open-meteo' ? new URL(endpoint).origin : null,
      variables: [
        'temperature_2m',
        'apparent_temperature',
        'weather_code',
        'cloud_cover',
        'is_day',
        'precipitation',
        'wind_speed_10m',
        'wind_direction_10m',
      ],
      credentialsExposed: false,
      attribution: 'Open-Meteo',
    };
  }

  async function current(input = {}) {
    const lat = validateCoordinate(input.lat, -90, 90, 'latitude');
    const lon = validateCoordinate(input.lon, -180, 180, 'longitude');
    if (provider !== 'open-meteo') return localFallback(lat, lon);

    try {
      const url = validateEndpoint(endpoint);
      url.searchParams.set('latitude', String(lat));
      url.searchParams.set('longitude', String(lon));
      url.searchParams.set(
        'current',
        [
          'temperature_2m',
          'apparent_temperature',
          'weather_code',
          'cloud_cover',
          'is_day',
          'precipitation',
          'wind_speed_10m',
          'wind_direction_10m',
          'wind_gusts_10m',
          'shortwave_radiation',
          'visibility',
        ].join(','),
      );
      url.searchParams.set('timezone', 'auto');
      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'AETHERGRID/2.6 (city-environment-runtime)',
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
      const payload = await response.json();
      const current = payload?.current || {};
      return {
        schemaVersion: 1,
        coordinate: { lat, lon },
        source: {
          provider: 'Open-Meteo',
          live: true,
          attribution: 'Weather data via Open-Meteo',
          fetchedAt: new Date().toISOString(),
          modelTime: current.time || null,
        },
        timezone: payload?.timezone || null,
        utcOffsetSeconds: Number(payload?.utc_offset_seconds || 0),
        current: {
          time: current.time || null,
          intervalSeconds: Number(current.interval || 0),
          temperatureC: Number.isFinite(Number(current.temperature_2m))
            ? Number(current.temperature_2m)
            : null,
          apparentTemperatureC: Number.isFinite(Number(current.apparent_temperature))
            ? Number(current.apparent_temperature)
            : null,
          weatherCode: Number.isFinite(Number(current.weather_code))
            ? Number(current.weather_code)
            : null,
          cloudCoverPercent: Number.isFinite(Number(current.cloud_cover))
            ? Number(current.cloud_cover)
            : null,
          isDay: Number(current.is_day) === 1,
          precipitationMm: Number.isFinite(Number(current.precipitation))
            ? Number(current.precipitation)
            : null,
          windSpeedKph: Number.isFinite(Number(current.wind_speed_10m))
            ? Number(current.wind_speed_10m)
            : null,
          windDirectionDegrees: Number.isFinite(Number(current.wind_direction_10m))
            ? Number(current.wind_direction_10m)
            : null,
          windGustsKph: Number.isFinite(Number(current.wind_gusts_10m))
            ? Number(current.wind_gusts_10m)
            : null,
          shortwaveRadiationWm2: Number.isFinite(Number(current.shortwave_radiation))
            ? Number(current.shortwave_radiation)
            : null,
          visibilityM: Number.isFinite(Number(current.visibility))
            ? Number(current.visibility)
            : null,
        },
      };
    } catch (error) {
      return localFallback(lat, lon, error);
    }
  }

  return { summary, current };
}
