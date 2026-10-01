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

    if (!configured() || lat === undefined || lon === undefined) {
      const fallbackData = {
        status: 'unconfigured',
        live: false,
        fallback: true,
        condition: 'Tomorrow.io Unconfigured / Missing Location',
      };
      return {
        data: fallbackData,
        receipt: {
          provider: 'tomorrow-io',
          dataset: 'weather-realtime',
          live: false,
          fallback: true,
          attribution: 'Tomorrow.io Weather API (Unconfigured)',
        },
      };
    }

    const url = `${baseUrl}/weather/realtime?location=${lat},${lon}&apikey=${encodeURIComponent(apiKey)}`;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Tomorrow.io HTTP ${resp.status}: ${resp.statusText}`);
      }
      const json = await resp.json();
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
        { url, dataset: 'weather-realtime', ttlMs: 180000, attribution: 'Tomorrow.io Weather API' },
        fetcher,
      );
    }

    const data = await fetcher();
    return { data, receipt: { provider: 'tomorrow-io', dataset: 'weather-realtime', live: true } };
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
