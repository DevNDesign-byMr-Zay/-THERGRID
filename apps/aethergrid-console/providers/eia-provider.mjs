import { createProviderAdapter } from './adapter.mjs';

export function createEiaProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_EIA_API_KEY || '';
  const baseUrl = options.baseUrl || process.env.AETHERGRID_EIA_BASE_URL || 'https://api.eia.gov/v2';

  function configured() {
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    const region = params.region || 'NYIS';

    const fallbackFetcher = async () => ({
      region,
      balancingAuthority: 'New York Independent System Operator (NYISO)',
      generationMixPercent: { nuclear: 24, hydro: 21, naturalGas: 43, wind: 8, solar: 4 },
      source: 'eia-v2-reference-unconfigured',
      live: false,
    });

    if (!configured()) {
      const fallbackData = await fallbackFetcher();
      return {
        data: fallbackData,
        receipt: {
          provider: 'eia-energy',
          dataset: 'electricity-mix',
          live: false,
          fallback: true,
          attribution: 'U.S. Energy Information Administration (EIA v2 Unconfigured Reference)',
        },
      };
    }

    const url = `${baseUrl}/electricity/rto/fuel-type-data/data/?api_key=${encodeURIComponent(apiKey)}&frequency=hourly&data[0]=value&facets[respondent][]=${encodeURIComponent(region)}&sort[0][column]=period&sort[0][direction]=desc&length=10`;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') return options.fetchFn(url);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`EIA API HTTP ${resp.status}`);
      const json = await resp.json();
      return {
        region,
        recordsCount: (json?.response?.data || []).length,
        recentRecords: (json?.response?.data || []).slice(0, 5),
        source: 'U.S. EIA API v2 Live',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'energy',
        { url, dataset: 'electricity-mix', ttlMs: 300000, attribution: 'U.S. Energy Information Administration (eia.gov)' },
        fetcher,
        fallbackFetcher,
      );
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'eia-energy',
        dataset: 'electricity-mix',
        live: true,
        attribution: 'U.S. Energy Information Administration (eia.gov)',
      },
    };
  }

  return createProviderAdapter({
    id: 'eia-energy',
    name: 'U.S. EIA Energy Context Provider',
    capabilities: ['energy'],
    configured,
    request,
  });
}
