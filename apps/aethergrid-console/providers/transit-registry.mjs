import { createProviderAdapter } from './adapter.mjs';

export function createTransitRegistry(options = {}) {
  const feedMap = new Map();

  function registerCityFeed(cityId, feedConfig) {
    feedMap.set(cityId.toLowerCase(), {
      cityId,
      agencyName: feedConfig.agencyName || cityId,
      gtfsRtUrl: feedConfig.gtfsRtUrl || '',
      apiKey: feedConfig.apiKey || '',
      configured: Boolean(feedConfig.gtfsRtUrl),
    });
  }

  function getCityFeed(cityId) {
    return feedMap.get(cityId.toLowerCase()) || null;
  }

  async function request(params = {}, context = {}) {
    const cityId = params.cityId || 'nyc';
    const feed = getCityFeed(cityId);

    const fallbackFetcher = async () => ({
      cityId,
      configured: false,
      vehicles: [],
      status: 'unconfigured',
    });

    if (!feed || !feed.configured) {
      const fallbackData = await fallbackFetcher();
      return {
        data: fallbackData,
        receipt: {
          provider: 'gtfs-rt-registry',
          dataset: 'transit-vehicles',
          live: false,
          fallback: true,
          attribution: `GTFS-RT Feed Unconfigured for ${cityId}`,
        },
      };
    }

    const url = feed.gtfsRtUrl;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') return options.fetchFn(url);
      const headers = {};
      if (feed.apiKey) headers['x-api-key'] = feed.apiKey;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`GTFS-RT HTTP ${resp.status}`);
      return {
        cityId,
        configured: true,
        agencyName: feed.agencyName,
        status: 'live',
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'transit',
        { url, dataset: 'transit-vehicles', ttlMs: 15000, attribution: `GTFS-RT Feed (${feed.agencyName})` },
        fetcher,
        fallbackFetcher,
      );
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'gtfs-rt-registry',
        dataset: 'transit-vehicles',
        live: true,
        attribution: `GTFS-RT Feed (${feed.agencyName})`,
      },
    };
  }

  return {
    registerCityFeed,
    getCityFeed,
    adapter: createProviderAdapter({
      id: 'gtfs-rt-registry',
      name: 'City-Specific GTFS-RT Transit Registry',
      capabilities: ['transit'],
      configured: () => feedMap.size > 0,
      request,
    }),
  };
}
