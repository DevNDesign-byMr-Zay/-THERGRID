import { createProviderAdapter } from './provider-adapter.mjs';

export function createNwsAlertsProvider(options = {}) {
  const baseUrl = options.baseUrl || process.env.AETHERGRID_NWS_URL || 'https://api.weather.gov';

  function configured() {
    return true;
  }

  async function request(params = {}, context = {}) {
    const lat = params.lat;
    const lon = params.lon;

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      return {
        data: {
          status: 'missing_coordinates',
          message: 'Valid lat/lon parameters are required for NWS active alerts.',
          alerts: [],
          live: false,
        },
        receipt: {
          provider: 'nws',
          capability: 'hazards',
          dataset: 'active-alerts',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'US National Weather Service (api.weather.gov)',
        },
      };
    }

    const url = `${baseUrl}/alerts/active?point=${lat},${lon}`;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }
      const resp = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'AETHERGRID/4.0 (contact@aethergrid.org)',
        },
      });
      if (!resp.ok) {
        throw new Error(`NWS Active Alerts HTTP ${resp.status}`);
      }
      const json = await resp.json();
      const features = Array.isArray(json.features) ? json.features : [];

      const alerts = features.map((f) => ({
        id: f.id || f.properties?.id,
        event: f.properties?.event || 'Unknown Alert',
        headline: f.properties?.headline || null,
        severity: f.properties?.severity || 'Unknown',
        urgency: f.properties?.urgency || 'Unknown',
        certainty: f.properties?.certainty || 'Unknown',
        effective: f.properties?.effective || null,
        expires: f.properties?.expires || null,
        areaDesc: f.properties?.areaDesc || null,
      }));

      return {
        count: alerts.length,
        alerts,
        location: { lat, lon },
        status: 'NWS Live Alerts',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'nws',
        {
          url,
          capability: 'hazards',
          dataset: 'active-alerts',
          requestId: params.requestId || context.requestId,
          ttlMs: 60000,
          attribution: 'US National Weather Service (api.weather.gov)',
        },
        fetcher,
      );
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'nws',
        capability: 'hazards',
        dataset: 'active-alerts',
        requestId: params.requestId || context.requestId,
        live: true,
      },
    };
  }

  return createProviderAdapter({
    id: 'nws',
    name: 'National Weather Service Active Hazards Provider',
    capability: 'hazards',
    capabilities: ['hazards', 'weather-alerts'],
    configured,
    request,
  });
}
