import { createProviderAdapter } from './adapter.mjs';

export function createNwsAlertsProvider(options = {}) {
  const baseUrl = options.baseUrl || process.env.AETHERGRID_NWS_API_URL || 'https://api.weather.gov';
  const userAgent = options.userAgent || process.env.AETHERGRID_GEO_USER_AGENT || 'AETHERGRID/2.6 (operator-console)';

  function configured() {
    return true;
  }

  async function request(params = {}, context = {}) {
    const lat = params.lat ?? 40.7128;
    const lon = params.lon ?? -74.006;
    const url = `${baseUrl}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;

    const fallbackFetcher = async () => ({ live: false, alerts: [] });

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }
      const resp = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/geo+json',
        },
      });
      if (!resp.ok) throw new Error(`NWS HTTP ${resp.status}`);
      const geojson = await resp.json();
      const features = Array.isArray(geojson?.features) ? geojson.features : [];

      return {
        live: true,
        alerts: features.map((f) => {
          const p = f.properties || {};
          return {
            id: p.id || f.id,
            event: p.event || 'Weather Alert',
            severity: p.severity || 'Unknown',
            certainty: p.certainty || 'Unknown',
            urgency: p.urgency || 'Unknown',
            headline: p.headline || p.event,
            description: p.description || '',
            instruction: p.instruction || '',
            onset: p.onset || null,
            expires: p.expires || null,
            geometry: f.geometry || null,
            affectedZones: p.affectedZones || [],
            source: 'US National Weather Service',
          };
        }),
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'hazards',
        { url, dataset: 'active-alerts', ttlMs: 60000, attribution: 'US National Weather Service (api.weather.gov)' },
        fetcher,
        fallbackFetcher,
      );
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'nws-alerts',
        dataset: 'active-alerts',
        live: true,
        attribution: 'US National Weather Service (api.weather.gov)',
      },
    };
  }

  return createProviderAdapter({
    id: 'nws-alerts',
    name: 'National Weather Service Hazards Provider',
    capabilities: ['hazards'],
    configured,
    request,
  });
}
