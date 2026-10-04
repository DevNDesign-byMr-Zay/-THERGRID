import { createProviderAdapter } from './provider-adapter.mjs';

export function createTransitlandProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_TRANSIT_API_KEY || '';
  const baseUrl = options.baseUrl || process.env.AETHERGRID_TRANSIT_BASE_URL || 'https://transit.land/api/v2/rest';

  function configured() {
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    if (!configured()) {
      return {
        data: {
          status: 'unconfigured',
          message: 'Transitland API key is not configured.',
          agencies: [],
          feeds: [],
          live: false,
        },
        receipt: {
          provider: 'transitland',
          capability: 'transit',
          dataset: 'agencies-feeds',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'Transitland (Unconfigured)',
        },
      };
    }

    const city = params.city || params.cityId || 'new-york';
    const endpoint = `${baseUrl}/agencies?search=${encodeURIComponent(city)}&limit=10`;

    const fetcher = async () => {
      let rawJson;
      if (typeof options.fetchFn === 'function') {
        rawJson = await options.fetchFn(endpoint);
      } else {
        const resp = await fetch(endpoint, {
          headers: {
            accept: 'application/json',
            'apikey': apiKey,
          },
        });
        if (!resp.ok) {
          throw new Error(`Transitland API HTTP ${resp.status}`);
        }
        rawJson = await resp.json();
      }

      const agencies = Array.isArray(rawJson.agencies) ? rawJson.agencies : [];
      const feeds = [];

      for (const ag of agencies) {
        if (Array.isArray(ag.feeds)) {
          for (const f of ag.feeds) {
            if (f.spec === 'gtfs-rt' || f.feed_type === 'gtfs-rt' || (f.urls && f.urls.realtime_vehicle_positions)) {
              feeds.push({
                feedId: f.onestop_id || f.id || ag.agency_id,
                agencyName: ag.agency_name || ag.name,
                feedUrl: f.urls?.realtime_vehicle_positions || f.url,
                spec: 'gtfs-rt',
              });
            }
          }
        }
      }

      return {
        city,
        agenciesCount: agencies.length,
        discoveredFeedsCount: feeds.length,
        feeds,
        status: 'Transitland Live Discovery',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      const exec = await context.executeProviderRequest(
        'transitland',
        {
          url: endpoint,
          capability: 'transit',
          dataset: 'agencies-feeds',
          requestId: params.requestId || context.requestId,
          ttlMs: 300000,
          attribution: 'Transitland REST API (transit.land)',
        },
        fetcher,
      );
      return { data: exec.data, receipt: exec.receipt };
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'transitland',
        capability: 'transit',
        dataset: 'agencies-feeds',
        requestId: params.requestId || context.requestId,
        live: true,
      },
    };
  }

  return createProviderAdapter({
    id: 'transitland',
    name: 'Transitland Mobility Discovery Provider',
    capability: 'transit',
    capabilities: ['transit', 'feed-discovery'],
    configured,
    request,
  });
}
