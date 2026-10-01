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

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
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
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }
      const resp = await fetch(url, {
        headers: {
          accept: 'application/json',
          'apikey': apiKey,
        },
      });
      if (!resp.ok) {
        throw new Error(`Tomorrow.io HTTP ${resp.status}`);
      }
      const json = await resp.json();
      return {
        data: json.data || {},
        location: { lat, lon },
        mode,
        status: 'Tomorrow.io Live',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
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
    capabilities: ['weather', 'forecast', 'air-quality'],
    configured,
    request,
  });
}
