import { createProviderAdapter } from './provider-adapter.mjs';

export function createTomorrowWeatherProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_TOMORROW_IO_API_KEY || '';
  const baseUrl = options.baseUrl || process.env.AETHERGRID_TOMORROW_IO_URL || 'https://api.tomorrow.io/v4';

  function configured() {
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    const lat = params.lat;
    const lon = params.lon;
    const mode = params.mode || 'realtime'; // 'realtime' | 'forecast'

    if (!configured() || lat === undefined || lon === undefined) {
      const fallbackData = {
        status: 'unconfigured',
        live: false,
        fallback: true,
        condition: 'Tomorrow.io Unconfigured / Missing Location',
        hourly: [],
      };
      return {
        data: fallbackData,
        receipt: {
          provider: 'tomorrow-io',
          capability: 'weather',
          dataset: `weather-${mode}`,
          live: false,
          fallback: true,
          attribution: 'Tomorrow.io Weather API (Unconfigured)',
        },
      };
    }

    const path = mode === 'forecast' ? '/weather/forecast' : '/weather/realtime';
    const url = `${baseUrl}${path}?location=${lat},${lon}`;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }
      const resp = await fetch(url, {
        headers: {
          'apikey': apiKey,
          'Accept': 'application/json',
        },
      });
      if (!resp.ok) {
        throw new Error(`Tomorrow.io HTTP ${resp.status}: ${resp.statusText}`);
      }
      const json = await resp.json();

      if (mode === 'forecast') {
        const hourly = json?.timelines?.hourly || [];
        const timeSeries = hourly.slice(0, 48).map((item) => ({
          eventTime: item.time || null,
          temperatureC: item.values?.temperature ?? null,
          relativeHumidityPercent: item.values?.humidity ?? null,
          windSpeedKph: Number.isFinite(Number(item.values?.windSpeed)) ? Number(item.values.windSpeed) * 3.6 : null,
        }));

        return {
          provider: 'Tomorrow.io Hourly Forecast',
          live: true,
          hourly: timeSeries,
          raw: json,
        };
      }

      const values = json?.data?.values || {};
      return {
        temperatureC: values.temperature ?? null,
        humidityPercent: values.humidity ?? null,
        windSpeedKmh: Number.isFinite(Number(values.windSpeed)) ? Number(values.windSpeed) * 3.6 : null,
        condition: 'Tomorrow.io Live Realtime',
        live: true,
        raw: json,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'tomorrow-io',
        { url, capability: 'weather', dataset: `weather-${mode}`, ttlMs: 180000, attribution: 'Tomorrow.io Weather API' },
        fetcher,
      );
    }

    const data = await fetcher();
    return {
      data,
      receipt: { provider: 'tomorrow-io', capability: 'weather', dataset: `weather-${mode}`, live: true },
    };
  }

  return createProviderAdapter({
    id: 'tomorrow-io',
    name: 'Tomorrow.io Weather Provider',
    capability: 'weather',
    capabilities: ['weather'],
    configured,
    request,
  });
}
