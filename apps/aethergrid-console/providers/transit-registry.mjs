import { createProviderAdapter } from './provider-adapter.mjs';

export function createTransitRegistry(options = {}) {
  const feedMap = new Map();

  function registerCityFeed(cityId, feedConfig) {
    if (!cityId || typeof cityId !== 'string') return;
    feedMap.set(cityId.toLowerCase().trim(), {
      cityId: cityId.trim(),
      agencyName: feedConfig.agencyName || cityId,
      gtfsRtUrl: feedConfig.gtfsRtUrl || '',
      apiKey: feedConfig.apiKey || '',
      configured: Boolean(feedConfig.gtfsRtUrl),
    });
  }

  function getCityFeed(cityId) {
    if (!cityId) return null;
    return feedMap.get(cityId.toLowerCase().trim()) || null;
  }

  async function request(params = {}, context = {}) {
    const cityId = params.cityId;
    const feed = getCityFeed(cityId);

    if (!cityId || !feed || !feed.configured) {
      return {
        data: {
          cityId: cityId || null,
          configured: false,
          vehicles: [],
          status: 'unconfigured',
          live: false,
        },
        receipt: {
          provider: 'gtfs-rt-registry',
          capability: 'transit',
          dataset: 'transit-vehicles',
          live: false,
          fallback: true,
          attribution: cityId ? `GTFS-RT Feed Unconfigured for ${cityId}` : 'GTFS-RT Transit Registry (Missing cityId)',
        },
      };
    }

    const url = feed.gtfsRtUrl;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }
      const headers = {};
      if (feed.apiKey) headers['x-api-key'] = feed.apiKey;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`GTFS-RT HTTP ${resp.status}`);

      return {
        cityId,
        configured: true,
        agencyName: feed.agencyName,
        status: 'feed_retrieved_undecoded',
        live: false,
        vehicles: [],
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'gtfs-rt-registry',
        { url, capability: 'transit', dataset: 'transit-vehicles', ttlMs: 15000, attribution: `GTFS-RT Feed (${feed.agencyName})` },
        fetcher,
      );
    }

    const data = await fetcher();
    return { data, receipt: { provider: 'gtfs-rt-registry', capability: 'transit', dataset: 'transit-vehicles', live: false, fallback: true } };
  }

  return {
    registerCityFeed,
    getCityFeed,
    adapter: createProviderAdapter({
      id: 'gtfs-rt-registry',
      name: 'City-Specific GTFS-RT Transit Registry',
      capability: 'transit',
      capabilities: ['transit'],
      configured: () => feedMap.size > 0,
      request,
    }),
  };
}
