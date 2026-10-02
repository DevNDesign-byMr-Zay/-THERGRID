import { validateCoordinates } from "./coordinate-validator.mjs";
import { createProviderAdapter } from './provider-adapter.mjs';

export function createTomorrowWeatherProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_TOMORROW_IO_API_KEY || '';
  const baseUrl = options.baseUrl || process.env.AETHERGRID_TOMORROW_IO_URL || 'https://api.tomorrow.io/v4';

  function configured() {
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    if (!configured()) {
      return {
        data: {
          status: 'unconfigured',
          message: 'Tomorrow.io API key is not configured.',
          live: false,
        },
        receipt: {
          provider: 'tomorrow-io',
          capability: 'weather',
          dataset: 'weather-realtime',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'Tomorrow.io Weather API (Unconfigured)',
        },
      };
    }

    const mode = params.mode === 'forecast' ? 'forecast' : 'realtime';
    const lat = params.lat;
    const lon = params.lon;

    const coordVal = validateCoordinates(lat, lon);
    if (!coordVal.valid) {
      return {
        data: {
          status: 'missing_coordinates',
          message: 'Valid lat/lon parameters are required for Tomorrow.io weather queries.',
          live: false,
        },
        receipt: {
          provider: 'tomorrow-io',
          capability: 'weather',
          dataset: `weather-${mode}`,
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'Tomorrow.io Weather API',
        },
      };
    }

    const endpoint = mode === 'forecast' ? `${baseUrl}/weather/forecast` : `${baseUrl}/weather/realtime`;
    const url = `${endpoint}?location=${lat},${lon}`;

    const fetcher = async () => {
      let rawJson;
      if (typeof options.fetchFn === 'function') {
        rawJson = await options.fetchFn(url);
      } else {
        const resp = await fetch(url, {
          headers: {
            accept: 'application/json',
            'apikey': apiKey,
          },
        });
        if (!resp.ok) {
          throw new Error(`Tomorrow.io HTTP ${resp.status}`);
        }
        rawJson = await resp.json();
      }

      if (mode === 'realtime') {
        const dataObj = rawJson.data || rawJson;
        const vals = dataObj.values || {};
        return {
          observedAt: dataObj.time || null,
          temperatureCelsius: vals.temperature !== undefined ? Number(vals.temperature) : null,
          temperatureApparentCelsius: vals.temperatureApparent !== undefined ? Number(vals.temperatureApparent) : null,
          humidityPercent: vals.humidity !== undefined ? Number(vals.humidity) : null,
          precipitationProbability: vals.precipitationProbability !== undefined ? Number(vals.precipitationProbability) : null,
          windSpeedMps: vals.windSpeed !== undefined ? Number(vals.windSpeed) : null,
          windDirectionDegrees: vals.windDirection !== undefined ? Number(vals.windDirection) : null,
          pressureSurfaceLevelHpa: vals.pressureSurfaceLevel !== undefined ? Number(vals.pressureSurfaceLevel) : null,
          visibilityKm: vals.visibility !== undefined ? Number(vals.visibility) : null,
          weatherCode: vals.weatherCode !== undefined ? Number(vals.weatherCode) : null,
          units: 'metric',
          location: { lat, lon },
          status: 'Tomorrow.io Live',
          live: true,
        };
      }

      // Forecast mode
      const modelRunAt = rawJson.time || null;
      const timelines = rawJson.data?.timelines || rawJson.timelines || {};
      const hourly = timelines.hourly || [];

      const timesteps = hourly.map((entry) => {
        const vals = entry.values || {};
        return {
          time: entry.time || null,
          temperatureCelsius: vals.temperature !== undefined ? Number(vals.temperature) : null,
          humidityPercent: vals.humidity !== undefined ? Number(vals.humidity) : null,
          weatherCode: vals.weatherCode !== undefined ? Number(vals.weatherCode) : null,
          values: vals,
        };
      });

      return {
        modelRunAt,
        timesteps,
        units: 'metric',
        location: { lat, lon },
        status: 'Tomorrow.io Live Forecast',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      const exec = await context.executeProviderRequest(
        'tomorrow-io',
        {
          url,
          capability: 'weather',
          dataset: `weather-${mode}`,
          requestId: params.requestId || context.requestId,
          ttlMs: 180000,
          attribution: 'Tomorrow.io Weather API',
        },
        fetcher,
      );
      return { data: exec.data, receipt: exec.receipt };
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'tomorrow-io',
        capability: 'weather',
        dataset: `weather-${mode}`,
        requestId: params.requestId || context.requestId,
        live: true,
      },
    };
  }

  return createProviderAdapter({
    id: 'tomorrow-io',
    name: 'Tomorrow.io Weather Provider',
    capability: 'weather',
    capabilities: ['weather', 'forecast'],
    configured,
    request,
  });
}
