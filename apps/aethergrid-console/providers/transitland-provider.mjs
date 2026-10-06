import { createProviderAdapter } from './provider-adapter.mjs';

function validateHttpsUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol === 'https:') return true;
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

const DISALLOWED_CREDENTIAL_PARAMS = new Set([
  'key',
  'api_key',
  'apikey',
  'token',
  'access_token',
  'auth',
  'authorization',
  'secret',
  'password',
  'credential',
  'client_secret',
]);

export function validateDiscoveredFeedUrl(feedUrl) {
  if (!feedUrl || typeof feedUrl !== 'string') {
    return { valid: false, reason: 'feed_url_missing_or_not_string' };
  }
  const cleanUrl = feedUrl.trim();
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, reason: 'invalid_protocol_must_be_http_or_https' };
    }
    if (
      parsed.protocol === 'http:' &&
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1'
    ) {
      return { valid: false, reason: 'remote_production_feeds_must_use_https' };
    }
    if (parsed.username || parsed.password) {
      return { valid: false, reason: 'url_embedded_basic_auth_not_permitted' };
    }
    for (const paramKey of parsed.searchParams.keys()) {
      if (DISALLOWED_CREDENTIAL_PARAMS.has(paramKey.toLowerCase())) {
        return { valid: false, reason: 'credential_query_parameter_requires_server_side_auth' };
      }
    }
    return { valid: true, url: cleanUrl, origin: parsed.origin };
  } catch {
    return { valid: false, reason: 'malformed_url_string' };
  }
}

function normalizedFeedUrl(value) {
  const validation = validateDiscoveredFeedUrl(value);
  return {
    url: validation.valid ? validation.url : null,
    valid: validation.valid,
    reason: validation.valid ? null : validation.reason,
  };
}

function boundedNumber(value, { min, max, fallback = null } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

export function createTransitlandProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_TRANSIT_API_KEY || '';
  const rawBaseUrl =
    options.baseUrl ||
    process.env.AETHERGRID_TRANSIT_BASE_URL ||
    'https://transit.land/api/v2/rest';
  const baseUrl = rawBaseUrl.replace(/\/+$/u, '');

  function configured() {
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    if (!configured()) {
      return {
        data: {
          status: 'unconfigured',
          message: 'Transitland API key is not configured on this server.',
          feeds: [],
          agencies: [],
          live: false,
        },
        receipt: {
          provider: 'transitland',
          capability: 'transit-discovery',
          dataset: 'feed-catalog',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'Transitland v2 REST API (Unconfigured)',
        },
      };
    }

    if (!validateHttpsUrl(baseUrl)) {
      throw new Error(`Invalid Transitland base URL '${baseUrl}'. Remote URLs must use HTTPS.`);
    }

    const city = String(params.city || params.query || params.q || '').trim();
    const rawLat = params.lat ?? params.latitude;
    const rawLon = params.lon ?? params.longitude;
    const latitude = Number(rawLat);
    const longitude = Number(rawLon);
    const hasCoordinates =
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180;

    const queryParams = new URLSearchParams();
    if (hasCoordinates) {
      queryParams.set('lat', String(latitude));
      queryParams.set('lon', String(longitude));
      queryParams.set(
        'radius',
        String(boundedNumber(params.radius, { min: 1, max: 10_000, fallback: 10_000 })),
      );
    } else if (city) {
      queryParams.set('search', city);
    }
    queryParams.set('limit', String(boundedNumber(params.limit, { min: 1, max: 50, fallback: 20 })));

    const endpointUrl = `${baseUrl}/feeds?${queryParams.toString()}`;

    const fetcher = async ({ signal } = {}) => {
      let rawJson;
      if (typeof options.fetchFn === 'function') {
        rawJson = await options.fetchFn(endpointUrl);
      } else {
        const resp = await fetch(endpointUrl, {
          method: 'GET',
          headers: {
            apikey: apiKey.trim(),
            accept: 'application/json',
          },
          signal,
        });
        if (!resp.ok) {
          throw new Error(`Transitland API HTTP ${resp.status}`);
        }
        rawJson = await resp.json();
      }

      const feeds = Array.isArray(rawJson?.feeds)
        ? rawJson.feeds
        : Array.isArray(rawJson)
          ? rawJson
          : [];

      const agencies = new Map();
      const discoveredFeeds = feeds.map((feed, index) => {
        const urls = feed?.urls && typeof feed.urls === 'object' ? feed.urls : {};
        const vehiclePositions = normalizedFeedUrl(urls.realtime_vehicle_positions);
        const tripUpdates = normalizedFeedUrl(urls.realtime_trip_updates);
        const alerts = normalizedFeedUrl(urls.realtime_alerts);
        const staticCurrent = normalizedFeedUrl(urls.static_current);
        const preferred =
          vehiclePositions.url || tripUpdates.url || alerts.url || staticCurrent.url || null;
        const operators = Array.isArray(feed?.associated_operators)
          ? feed.associated_operators
          : Array.isArray(feed?.operators)
            ? feed.operators
            : [];

        for (const operator of operators) {
          const key = String(operator?.onestop_id || operator?.id || operator?.name || '').trim();
          if (!key || agencies.has(key)) continue;
          agencies.set(key, {
            onestopId: operator?.onestop_id || operator?.id || null,
            name: operator?.name || operator?.short_name || null,
          });
        }

        return {
          id: feed?.onestop_id || feed?.id || `feed-${index + 1}`,
          name: feed?.name || operators[0]?.name || null,
          agencyName: operators[0]?.name || feed?.name || 'Unknown Agency',
          spec: feed?.spec || null,
          feedUrl: preferred,
          feedUrlValid: Boolean(preferred),
          validationReason: preferred ? null : 'no_safe_source_url_available',
          realtimeAvailable: Boolean(
            vehiclePositions.url || tripUpdates.url || alerts.url,
          ),
          vehiclePositionsAvailable: Boolean(vehiclePositions.url),
          tripUpdatesAvailable: Boolean(tripUpdates.url),
          alertsAvailable: Boolean(alerts.url),
          urls: {
            realtimeVehiclePositions: vehiclePositions.url,
            realtimeTripUpdates: tripUpdates.url,
            realtimeAlerts: alerts.url,
            staticCurrent: staticCurrent.url,
          },
        };
      });

      return {
        query: hasCoordinates
          ? {
              latitude,
              longitude,
              radiusMeters: Number(queryParams.get('radius')),
            }
          : city || 'all',
        agencyCount: agencies.size,
        feedCount: discoveredFeeds.length,
        agencies: [...agencies.values()],
        feeds: discoveredFeeds,
        status: 'Transitland Catalog Discovered',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      const exec = await context.executeProviderRequest(
        'transitland',
        {
          url: endpointUrl,
          capability: 'transit-discovery',
          dataset: 'feed-catalog',
          requestId: params.requestId || context.requestId,
          ttlMs: 300000,
          attribution: 'Transitland v2 REST API (transit.land)',
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
        capability: 'transit-discovery',
        dataset: 'feed-catalog',
        requestId: params.requestId || context.requestId,
        live: true,
      },
    };
  }

  return createProviderAdapter({
    id: 'transitland',
    name: 'Transitland v2 Catalog Discovery Provider',
    capability: 'transit-discovery',
    capabilities: ['transit-discovery', 'feed-catalog'],
    configured,
    request,
  });
}
