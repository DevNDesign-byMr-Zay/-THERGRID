import { createProviderAdapter } from './adapter.mjs';

export function createTomorrowWeatherProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_TOMORROW_IO_API_KEY || '';
  const baseUrl = options.baseUrl || process.env.AETHERGRID_TOMORROW_IO_URL || 'https://api.tomorrow.io/v4';

  function configured() {
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    const lat = params.lat ?? 40.7128;
    const lon = params.lon ?? -74.006;

    const fallbackFetcher = async () => ({
      temperatureC: 20.0,
      humidityPercent: 50,
      windSpeedKmh: 12.0,
      condition: 'Clear (Tomorrow.io Local Fallback)',
      source: 'tomorrow-io-fallback',
    });

    if (!configured()) {
      const fallbackData = await fallbackFetcher();
      return {
        data: fallbackData,
        receipt: {
          provider: 'tomorrow-io',
          dataset: 'weather-realtime',
          live: false,
          fallback: true,
          attribution: 'Tomorrow.io Weather API (Unconfigured Fallback)',
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
        temperatureC: values.temperature ?? 20,
        humidityPercent: values.humidity ?? 50,
        windSpeedKmh: (values.windSpeed ?? 3) * 3.6,
        condition: 'Tomorrow.io Live Realtime',
        raw: json,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'tomorrow-io',
        { url, dataset: 'weather-realtime', ttlMs: 180000, attribution: 'Tomorrow.io Weather API' },
        fetcher,
        fallbackFetcher,
      );
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'tomorrow-io',
        dataset: 'weather-realtime',
        live: true,
        attribution: 'Tomorrow.io Weather API',
      },
    };
  }

  return createProviderAdapter({
    id: 'tomorrow-io',
    name: 'Tomorrow.io Weather Provider',
    capabilities: ['weather'],
    configured,
    request,
  });
}
