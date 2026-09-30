import { createProviderAdapter } from './adapter.mjs';

export function createNoaaNwpsHydrologyProvider(options = {}) {
  const baseUrl = options.baseUrl || process.env.AETHERGRID_HYDROLOGY_BASE_URL || 'https://api.water.noaa.gov/nwps/v1';

  function configured() {
    return true;
  }

  async function request(params = {}, context = {}) {
    const gaugeId = params.gaugeId || 'NYCN6';
    const url = `${baseUrl}/gauges/${gaugeId}`;

    const fallbackFetcher = async () => ({
      gaugeId,
      name: 'Hudson River Reference Gauge',
      observedStageFeet: 3.2,
      actionStageFeet: 5.0,
      minorFloodStageFeet: 6.5,
      status: 'noaa-nwps-offline-fallback',
      live: false,
    });

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') return options.fetchFn(url);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`NOAA NWPS HTTP ${resp.status}`);
      const json = await resp.json();
      return {
        gaugeId,
        name: json.name || gaugeId,
        observedStageFeet: json.status?.observed?.primary || 0,
        actionStageFeet: json.flood?.action || 0,
        minorFloodStageFeet: json.flood?.minor || 0,
        moderateFloodStageFeet: json.flood?.moderate || 0,
        majorFloodStageFeet: json.flood?.major || 0,
        observedAt: json.status?.observed?.validTime || new Date().toISOString(),
        status: 'NOAA NWPS Live',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'hydrology',
        { url, dataset: 'hydrology-gauge', ttlMs: 180000, attribution: 'NOAA National Water Prediction Service (NWPS)' },
        fetcher,
        fallbackFetcher,
      );
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'noaa-nwps',
        dataset: 'hydrology-gauge',
        live: true,
        attribution: 'NOAA National Water Prediction Service (NWPS)',
      },
    };
  }

  return createProviderAdapter({
    id: 'noaa-nwps',
    name: 'NOAA National Water Prediction Service Provider',
    capabilities: ['hydrology'],
    configured,
    request,
  });
}
