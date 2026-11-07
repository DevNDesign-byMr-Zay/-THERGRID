import { createProviderAdapter } from './provider-adapter.mjs';

import { decodeGtfsRealtime } from './gtfs-realtime-decoder.mjs';

export { decodeGtfsRealtime };

export function createTransitRegistry(options = {}) {
  const feeds = { ...(options.feeds || options.customFeeds || {}) };

  function configured(cityId) {
    if (!cityId) return Object.keys(feeds).length > 0;
    return Boolean(feeds[String(cityId).toLowerCase()]);
  }

  async function request(params = {}, context = {}) {
    const cityId = params.cityId ? String(params.cityId).toLowerCase() : null;

    if (!cityId || !feeds[cityId]) {
      return {
        data: {
          cityId,
          status: 'unconfigured',
          message: cityId
            ? `No GTFS-Realtime feed registered for city '${cityId}'. Registered feeds: ${Object.keys(feeds).join(', ') || 'none'}`
            : 'Explicit cityId parameter is required for transit vehicles lookup.',
          vehicles: [],
          tripUpdates: [],
          alerts: [],
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
    const url = feed.feedUrl || feed.gtfsRealtimeUrl;
    const messageType = feed.messageType || 'vehicle-positions';
    const dataset =
      messageType === 'trip-updates'
        ? 'transit-trip-updates'
        : messageType === 'alerts'
          ? 'transit-alerts'
          : 'transit-vehicles';

    const fetcher = async ({ signal } = {}) => {
      if (typeof options.fetchFn === 'function') {
        const rawRes = await options.fetchFn(url);
        return rawRes;
      }

      const headers = { ...feed.headers };
      if (feed.authHeader) {
        headers['Authorization'] = feed.authHeader;
      }

      const resp = await fetch(url, { headers, signal });
      if (!resp.ok) {
        throw new Error(`GTFS-RT Feed HTTP ${resp.status}`);
      }

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        return await resp.json();
      }

      const arrayBuffer = await resp.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    };

    const runRequest = async () => {
      if (typeof context.executeProviderRequest === 'function') {
        const exec = await context.executeProviderRequest(
          'gtfs-rt-registry',
          {
            url,
            capability: 'transit',
            dataset,
            requestId: params.requestId || context.requestId,
            ttlMs: 15000,
            attribution: `GTFS-RT Feed (${feed.agencyName || feed.agency || cityId})`,
          },
          fetcher,
        );
        return exec.data;
      }
      return await fetcher();
    };

    let rawData;
    try {
      rawData = await runRequest();
    } catch {
      return {
        data: {
          cityId,
          agencyName: feed.agencyName || feed.agency || cityId,
          gtfsRealtimeUrl: url,
          messageType,
          status: 'feed_fetch_failed',
          message: 'Failed to retrieve GTFS-Realtime feed.',
          vehicles: [],
          tripUpdates: [],
          alerts: [],
          live: false,
        },
        receipt: {
          provider: 'gtfs-rt-registry',
          capability: 'transit',
          dataset,
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: `GTFS-RT Feed (${feed.agencyName || feed.agency || cityId})`,
        },
      };
    }

    let decodedMessage = null;
    let vehicles = [];
    let tripUpdates = [];
    let alerts = [];
    let feedHeaderTimestamp = null;

    if (rawData && typeof rawData === 'object' && !ArrayBuffer.isView(rawData) && !Array.isArray(rawData) && (rawData.header || rawData.entities || rawData.vehicles)) {
      decodedMessage = rawData;
      feedHeaderTimestamp = rawData.header?.timestamp || null;
      if (Array.isArray(rawData.vehicles)) {
        vehicles = rawData.vehicles;
      }
    } else if (rawData && (ArrayBuffer.isView(rawData) || rawData instanceof ArrayBuffer)) {
      decodedMessage = decodeGtfsRealtime(rawData);
    }

    if (!decodedMessage) {
      return {
        data: {
          cityId,
          agencyName: feed.agencyName || feed.agency || cityId,
          gtfsRealtimeUrl: url,
          messageType,
          status: 'feed_retrieved_undecoded',
          message: 'GTFS-Realtime binary feed retrieved but failed to decode protobuf payload.',
          vehicles: [],
          tripUpdates: [],
          alerts: [],
          live: false,
        },
        receipt: {
          provider: 'gtfs-rt-registry',
          capability: 'transit',
          dataset: 'transit-vehicles',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: `GTFS-RT Feed (${feed.agencyName || feed.agency || cityId})`,
        },
      };
    }

    feedHeaderTimestamp = decodedMessage.header?.timestamp || feedHeaderTimestamp;
    const entities = Array.isArray(decodedMessage.entities) ? decodedMessage.entities : [];

    for (const ent of entities) {
      if (ent.vehicle) {
        const v = ent.vehicle;
        vehicles.push({
          entityId: ent.id,
          agencyId: feed.agency || feed.agencyName || cityId,
          vehicleId: v.vehicle?.id || ent.id,
          tripId: v.trip?.tripId || null,
          routeId: v.trip?.routeId || null,
          latitude: Number.isFinite(v.position?.latitude) ? v.position.latitude : null,
          longitude: Number.isFinite(v.position?.longitude) ? v.position.longitude : null,
          bearing: Number.isFinite(v.position?.bearing) ? v.position.bearing : null,
          speed: Number.isFinite(v.position?.speed) ? v.position.speed : null,
          currentStatus: v.currentStatus ?? null,
          stopId: v.stopId || null,
          stopSequence: v.currentStopSequence ?? null,
          timestamp: v.timestamp || feedHeaderTimestamp || null,
          feedHeaderTimestamp,
        });
      }
      if (ent.tripUpdate) {
        const tu = ent.tripUpdate;
        tripUpdates.push({
          entityId: ent.id,
          tripId: tu.trip?.tripId || null,
          routeId: tu.trip?.routeId || null,
          scheduleRelationship: tu.trip?.scheduleRelationship ?? null,
          delay: tu.delay ?? null,
          stopTimeUpdate: tu.stopTimeUpdate || [],
          timestamp: tu.timestamp || feedHeaderTimestamp || null,
        });
      }
      if (ent.alert) {
        const a = ent.alert;
        alerts.push({
          entityId: ent.id,
          activePeriod: a.activePeriod || [],
          informedEntity: a.informedEntity || [],
          cause: a.cause ?? null,
          effect: a.effect ?? null,
          severityLevel: a.severityLevel ?? null,
          headerText: a.headerText || '',
          descriptionText: a.descriptionText || '',
        });
      }
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const isStale = feedHeaderTimestamp ? nowSec - Number(feedHeaderTimestamp) > 300 : false;

    const feedObservedAt =
      Number.isFinite(Number(feedHeaderTimestamp)) && Number(feedHeaderTimestamp) > 0
        ? new Date(Number(feedHeaderTimestamp) * 1000).toISOString()
        : null;

    const data = {
      cityId,
      agencyName: feed.agencyName || feed.agency || cityId,
      gtfsRealtimeUrl: url,
      messageType,
      status: 'GTFS-Realtime Live',
      vehicles,
      tripUpdates,
      alerts,
      count: vehicles.length,
      recordCount: vehicles.length + tripUpdates.length + alerts.length,
      feedHeaderTimestamp,
      retrievedAt: new Date().toISOString(),
      live: true,
      stale: isStale,
    };

    return {
      data,
      receipt: {
        provider: 'gtfs-rt-registry',
        capability: 'transit',
        dataset,
        requestId: params.requestId || context.requestId,
        retrievedAt: data.retrievedAt,
        observedAt: feedObservedAt,
        live: true,
        stale: isStale,
        attribution: `GTFS-RT Feed (${data.agencyName})`,
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
      if (id && feedInfo) {
        feeds[String(id).toLowerCase()] = feedInfo;
      }
    },
    getRegisteredFeeds: () => ({ ...feeds }),
  };
}
