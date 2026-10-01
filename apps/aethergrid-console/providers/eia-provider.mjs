import { createProviderAdapter } from './provider-adapter.mjs';

const VALID_REGION_REGEX = /^[A-Z0-9_-]{2,20}$/;

export function createEiaProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_EIA_API_KEY || '';
  const baseUrl = options.baseUrl || process.env.AETHERGRID_EIA_URL || 'https://api.eia.gov/v2';

  function configured() {
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    const region = params.region;

    if (!region || typeof region !== 'string' || region.trim() === '') {
      return {
        data: {
          region: null,
          status: 'unconfigured',
          message: 'Explicit region query parameter (e.g. CISO, ERCO, PJM, NYIS) is required for EIA electricity mix lookup.',
          live: false,
        },
        receipt: {
          provider: 'eia',
          capability: 'energy',
          dataset: 'electricity-mix',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'U.S. Energy Information Administration (Missing Region)',
        },
      };
    }

    const cleanRegion = region.trim().toUpperCase();

    if (!VALID_REGION_REGEX.test(cleanRegion)) {
      return {
        data: {
          region: cleanRegion,
          status: 'invalid_region',
          message: `Region code '${cleanRegion}' contains invalid characters or length.`,
          fuelMix: [],
          live: false,
        },
        receipt: {
          provider: 'eia',
          capability: 'energy',
          dataset: 'electricity-mix',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'U.S. Energy Information Administration',
        },
      };
    }

    const url = `${baseUrl}/electricity/rto/fuel-type-data/data/?api_key=${apiKey}&facets[respondent][]=${cleanRegion}&frequency=hourly&data[]=value&sort[0][column]=period&sort[0][direction]=desc&length=24`;

    const fetcher = async () => {
      let rawJson;
      if (typeof options.fetchFn === 'function') {
        rawJson = await options.fetchFn(url);
      } else {
        if (!configured()) {
          return {
            region: cleanRegion,
            status: 'unconfigured',
            message: 'EIA API key is not configured on this server.',
            fuelMix: [],
            live: false,
          };
        }
        const resp = await fetch(url);
        if (!resp.ok) {
          throw new Error(`EIA API HTTP ${resp.status}`);
        }
        rawJson = await resp.json();
      }

      const rows = Array.isArray(rawJson.response?.data) ? rawJson.response.data : (Array.isArray(rawJson) ? rawJson : []);

      const fuelMix = rows.map((r) => {
        const val = r.value;
        const validVal = val !== null && val !== undefined && val !== '' && Number.isFinite(Number(val));
        return {
          period: r.period || null,
          respondent: r.respondent || cleanRegion,
          fueltype: r.fueltype || null,
          fueltypeDescription: r['type-name'] || r.fueltypeDescription || r.fueltype || null,
          value: validVal ? Number(val) : null,
          sourceUnits: r.units || r.sourceUnits || 'megawatthours',
        };
      });

      return {
        region: cleanRegion,
        fuelMix,
        status: 'EIA Live Electricity Mix',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      const exec = await context.executeProviderRequest(
        'eia',
        {
          url,
          capability: 'energy',
          dataset: 'electricity-mix',
          requestId: params.requestId || context.requestId,
          ttlMs: 300000,
          attribution: 'U.S. Energy Information Administration (eia.gov)',
        },
        fetcher,
      );
      return { data: exec.data, receipt: exec.receipt };
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'eia',
        capability: 'energy',
        dataset: 'electricity-mix',
        requestId: params.requestId || context.requestId,
        live: true,
      },
    };
  }

  return createProviderAdapter({
    id: 'eia',
    name: 'U.S. EIA Electricity Fuel Mix Provider',
    capability: 'energy',
    capabilities: ['energy', 'grid-generation'],
    configured,
    request,
  });
}
