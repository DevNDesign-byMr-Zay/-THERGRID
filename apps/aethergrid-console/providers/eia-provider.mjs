import { createProviderAdapter } from './provider-adapter.mjs';

export function createEiaProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_EIA_API_KEY || '';
  const baseUrl = options.baseUrl || process.env.AETHERGRID_EIA_BASE_URL || 'https://api.eia.gov/v2';

  function configured() {
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    const region = params.region;

    if (!configured() || !region || typeof region !== 'string' || region.trim() === '') {
      return {
        data: {
          region: region || null,
          status: 'unconfigured',
          message: configured() ? 'Explicit region parameter is required' : 'AETHERGRID_EIA_API_KEY is unconfigured',
          live: false,
        },
        receipt: {
          provider: 'eia',
          capability: 'energy',
          dataset: 'electricity-mix',
          live: false,
          fallback: true,
          attribution: 'U.S. EIA API (Unconfigured)',
        },
      };
    }

    const cleanRegion = region.trim().toUpperCase();
    const url = `${baseUrl}/electricity/rto/fuel-type-data/data/?api_key=${encodeURIComponent(apiKey)}&frequency=hourly&data[0]=value&facets[respondent][]=${encodeURIComponent(cleanRegion)}&sort[0][column]=period&sort[0][direction]=desc&length=10`;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`EIA API HTTP ${resp.status}`);
      }
      const json = await resp.json();
      const rows = json?.response?.data || [];

      return {
        region: cleanRegion,
        recordsCount: rows.length,
        records: rows.map((r) => ({
          period: r.period || null,
          fuelType: r['type-name'] || r.fueltype || null,
          generationValue: Number.isFinite(Number(r.value)) ? Number(r.value) : null,
          units: r['value-units'] || 'MWh',
        })),
        source: 'U.S. EIA API v2 Live',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'eia',
        { url, capability: 'energy', dataset: 'electricity-mix', ttlMs: 300000, attribution: 'U.S. Energy Information Administration (eia.gov)' },
        fetcher,
      );
    }

    const data = await fetcher();
    return { data, receipt: { provider: 'eia', capability: 'energy', dataset: 'electricity-mix', live: true } };
  }

  return createProviderAdapter({
    id: 'eia',
    name: 'U.S. EIA Energy Context Provider',
    capability: 'energy',
    capabilities: ['energy'],
    configured,
    request,
  });
}
