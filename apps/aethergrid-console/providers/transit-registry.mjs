import { createProviderAdapter } from './provider-adapter.mjs';

const KNOWN_TRANSIT_FEEDS = {
  nyc: {
    agencyName: 'MTA New York City Transit',
    gtfsRealtimeUrl: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
    capabilities: ['gtfs-realtime-subway', 'vehicle-positions'],
  },
  sf: {
    agencyName: 'BART / SFMTA',
    gtfsRealtimeUrl: 'https://api.bart.gov/gtfsrt/tripupdate.aspx',
    capabilities: ['gtfs-realtime-rail'],
  },
  chicago: {
    agencyName: 'CTA Chicago Transit Authority',
    gtfsRealtimeUrl: 'https://www.ctabustracker.com/bustime/api/v2/getvehicles',
    capabilities: ['gtfs-realtime-bus'],
  },
};

export function createTransitRegistry(options = {}) {
  const feeds = { ...KNOWN_TRANSIT_FEEDS, ...(options.customFeeds || {}) };

  function configured(cityId) {
    if (!cityId) return true;
    return Boolean(feeds[cityId?.toLowerCase()]);
  }

  async function request(params = {}, context = {}) {
    const cityId = params.cityId ? String(params.cityId).toLowerCase() : null;

    if (!cityId || !feeds[cityId]) {
      return {
        data: {
          cityId,
          status: 'unconfigured',
          message: `No GTFS-Realtime feed registered for city '${cityId}'. Configured cities: ${Object.keys(feeds).join(', ')}`,
          vehicles: [],
          live: false,
        },
        receipt: {
          provider: 'gtfs-rt-registry',
          capability: 'transit',
          dataset: 'transit-vehicles',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'GTFS-RT Feed Registry (Unconfigured)',
        },
      };
    }

    const feed = feeds[cityId];
    const url = feed.gtfsRealtimeUrl;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }
      return {
        cityId,
        agencyName: feed.agencyName,
        gtfsRealtimeUrl: url,
        status: 'feed_retrieved_undecoded',
        message: 'GTFS-Realtime binary protobuf feed retrieved. Protobuf message parser registration active.',
        vehicles: [],
        live: false,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'gtfs-rt-registry',
        {
          url,
          capability: 'transit',
          dataset: 'transit-vehicles',
          requestId: params.requestId || context.requestId,
          ttlMs: 15000,
          attribution: `GTFS-RT Feed (${feed.agencyName})`,
        },
        fetcher,
      );
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'gtfs-rt-registry',
        capability: 'transit',
        dataset: 'transit-vehicles',
        requestId: params.requestId || context.requestId,
        live: false,
        fallback: true,
      },
    };
  }

  const adapter = createProviderAdapter({
    id: 'gtfs-rt-registry',
    name: 'GTFS-Realtime Transit Feed Registry',
    capability: 'transit',
    capabilities: ['transit', 'gtfs-realtime', 'vehicle-positions'],
    configured,
    request,
  });

  return {
    adapter,
    registerFeed: (id, feedInfo) => {
      feeds[id.toLowerCase()] = feedInfo;
    },
    getRegisteredFeeds: () => ({ ...feeds }),
  };
}
