import { createProviderAdapter } from './provider-adapter.mjs';

function validateHttpsUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol === 'https:') return true;
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

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
    if (parsed.protocol === 'http:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return { valid: false, reason: 'remote_production_feeds_must_use_https' };
    }
    return { valid: true, url: cleanUrl, origin: parsed.origin };
  } catch {
    return { valid: false, reason: 'malformed_url_string' };
  }
}

export function createTransitlandProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_TRANSIT_API_KEY || '';
  const rawBaseUrl = options.baseUrl || process.env.AETHERGRID_TRANSIT_BASE_URL || 'https://transit.land/api/v2/rest';
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
          dataset: 'agency-catalog',
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

    const city = (params.city || params.query || params.q || '').trim();
    const lat = params.lat ?? params.latitude;
    const lon = params.lon ?? params.longitude;

    const queryParams = new URLSearchParams();
    if (city) queryParams.set('search', city);
    if (lat !== undefined && lon !== undefined) {
      queryParams.set('lat', String(lat));
      queryParams.set('lon', String(lon));
      if (params.radius) queryParams.set('radius', String(params.radius));
    }
    queryParams.set('limit', String(Math.max(1, Math.min(50, Number(params.limit) || 20))));

    const endpointUrl = `${baseUrl}/agencies?${queryParams.toString()}`;

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

      const agencies = Array.isArray(rawJson?.agencies)
        ? rawJson.agencies
        : Array.isArray(rawJson)
          ? rawJson
          : [];

      const discoveredFeeds = [];
      for (const agency of agencies) {
        const feeds = Array.isArray(agency.feeds) ? agency.feeds : [];
        for (const feed of feeds) {
          const rawUrl = feed.urls?.static_current || feed.urls?.realtime_vehicle_positions || feed.url;
          const valResult = validateDiscoveredFeedUrl(rawUrl);
          discoveredFeeds.push({
            id: feed.onestop_id || feed.id || `feed-${agency.agency_id || agency.id}`,
            agencyName: agency.agency_name || agency.name || 'Unknown Agency',
            city: agency.city || city || null,
            feedUrl: valResult.valid ? valResult.url : null,
            feedUrlValid: valResult.valid,
            validationReason: valResult.valid ? null : valResult.reason,
            spec: feed.spec || 'gtfs',
            realtimeAvailable: Boolean(feed.urls?.realtime_vehicle_positions),
          });
        }
      }

      return {
        query: city || (lat !== undefined ? `${lat},${lon}` : 'all'),
        agencyCount: agencies.length,
        agencies: agencies.map((a) => ({
          onestopId: a.onestop_id || a.id,
          name: a.agency_name || a.name,
          places: a.places || [],
        })),
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
          dataset: 'agency-catalog',
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
        dataset: 'agency-catalog',
        requestId: params.requestId || context.requestId,
        live: true,
      },
    };
  }

  return createProviderAdapter({
    id: 'transitland',
    name: 'Transitland v2 Catalog Discovery Provider',
    capability: 'transit-discovery',
    capabilities: ['transit-discovery', 'agency-catalog'],
    configured,
    request,
  });
}
