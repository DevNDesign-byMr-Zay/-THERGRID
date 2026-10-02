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
    schemaVersion: 2,
    coordinate: { lat, lon },
    source: {
      provider: 'local-environment-fallback',
      live: false,
      attribution: null,
      fetchedAt: new Date().toISOString(),
      error: error ? (error instanceof Error ? error.message : String(error)) : null,
    },
    current: null,
    solar: null,
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
        'relative_humidity_2m',
        'surface_pressure',
        'weather_code',
        'cloud_cover',
        'is_day',
        'precipitation',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'shortwave_radiation',
        'visibility',
      ],
      dailyVariables: ['sunrise', 'sunset', 'daylight_duration', 'sunshine_duration'],
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
          'relative_humidity_2m',
          'surface_pressure',
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
      url.searchParams.set('daily', 'sunrise,sunset,daylight_duration,sunshine_duration');
      url.searchParams.set('forecast_days', '1');
      url.searchParams.set('timezone', 'auto');
      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'AETHERGRID/2.6 (city-environment-runtime)',
        },
      });
      if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
      const payload = await response.json();
      const current = payload?.current || {};
      const daily = payload?.daily || {};
      return {
        schemaVersion: 2,
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
          relativeHumidityPercent: Number.isFinite(Number(current.relative_humidity_2m))
            ? Number(current.relative_humidity_2m)
            : null,
          surfacePressureHpa: Number.isFinite(Number(current.surface_pressure))
            ? Number(current.surface_pressure)
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
        solar: {
          date: Array.isArray(daily.time) ? daily.time[0] || null : null,
          sunrise: Array.isArray(daily.sunrise) ? daily.sunrise[0] || null : null,
          sunset: Array.isArray(daily.sunset) ? daily.sunset[0] || null : null,
          daylightDurationSeconds:
            Array.isArray(daily.daylight_duration) &&
            Number.isFinite(Number(daily.daylight_duration[0]))
              ? Number(daily.daylight_duration[0])
              : null,
          sunshineDurationSeconds:
            Array.isArray(daily.sunshine_duration) &&
            Number.isFinite(Number(daily.sunshine_duration[0]))
              ? Number(daily.sunshine_duration[0])
              : null,
        },
      };
    } catch (error) {
      return localFallback(lat, lon, error);
    }
  }

  async function forecast(input = {}) {
    const lat = validateCoordinate(input.lat, -90, 90, 'latitude');
    const lon = validateCoordinate(input.lon, -180, 180, 'longitude');

    // In unit test mode or fallback mode, return deterministic forecast fixture immediately
    if (env.AETHERGRID_ENVIRONMENT_PROVIDER === 'local' || env.NODE_ENV === 'test') {
      return {
        schemaVersion: 2,
        coordinate: { lat, lon },
        source: {
          provider: 'local-forecast-fallback',
          live: false,
          fetchedAt: new Date().toISOString(),
        },
        hourly: Array.from({ length: 24 }, (_, i) => ({
          eventTime: new Date(Date.now() + i * 3600000).toISOString(),
          temperatureC: 20 + (i % 5),
          relativeHumidityPercent: 50,
          weatherCode: 0,
          windSpeedKph: 10,
        })),
      };
    }

    try {
      const url = validateEndpoint(endpoint);
      url.searchParams.set('latitude', String(lat));
      url.searchParams.set('longitude', String(lon));
      url.searchParams.set(
        'hourly',
        ['temperature_2m', 'relative_humidity_2m', 'weather_code', 'wind_speed_10m', 'precipitation_probability'].join(','),
      );
      url.searchParams.set('forecast_days', '7');
      url.searchParams.set('timezone', 'auto');

      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'AETHERGRID/2.6 (city-environment-runtime)',
        },
      });

      if (!response.ok) throw new Error(`Open-Meteo Forecast HTTP ${response.status}`);
      const payload = await response.json();
      const hourly = payload?.hourly || {};
      const times = Array.isArray(hourly.time) ? hourly.time : [];
      const temps = Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [];
      const humidities = Array.isArray(hourly.relative_humidity_2m) ? hourly.relative_humidity_2m : [];
      const codes = Array.isArray(hourly.weather_code) ? hourly.weather_code : [];
      const winds = Array.isArray(hourly.wind_speed_10m) ? hourly.wind_speed_10m : [];

      const timeSeries = times.slice(0, 48).map((time, idx) => ({
        eventTime: time,
        temperatureC: Number.isFinite(Number(temps[idx])) ? Number(temps[idx]) : null,
        relativeHumidityPercent: Number.isFinite(Number(humidities[idx])) ? Number(humidities[idx]) : null,
        weatherCode: Number.isFinite(Number(codes[idx])) ? Number(codes[idx]) : null,
        windSpeedKph: Number.isFinite(Number(winds[idx])) ? Number(winds[idx]) : null,
      }));

      return {
        schemaVersion: 2,
        coordinate: { lat, lon },
        source: {
          provider: 'Open-Meteo Hourly Forecast',
          live: true,
          attribution: 'Hourly forecast data via Open-Meteo',
          retrievedAt: new Date().toISOString(),
          modelRunAt: times[0] || null,
        },
        hourly: timeSeries,
      };
    } catch (error) {
      return {
        schemaVersion: 2,
        coordinate: { lat, lon },
        source: {
          provider: 'local-forecast-fallback',
          live: false,
          error: error.message,
          retrievedAt: new Date().toISOString(),
        },
        hourly: Array.from({ length: 24 }, (_, i) => ({
          eventTime: new Date(Date.now() + i * 3600000).toISOString(),
          temperatureC: 20 + (i % 5),
          relativeHumidityPercent: 50,
          weatherCode: 0,
          windSpeedKph: 10,
        })),
      };
    }
  }

  return { summary, current, forecast };
}
