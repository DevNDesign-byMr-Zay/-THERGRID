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

export function createOvertureProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_OVERTURE_API_KEY || '';
  const rawBaseUrl = options.baseUrl || process.env.AETHERGRID_OVERTURE_MAPS_URL || 'https://overturemaps.org/api/v1';
  const baseUrl = rawBaseUrl.replace(/\/+$/u, '');

  function configured() {
    return Boolean(apiKey && apiKey.trim().length > 0) || Boolean(options.baseUrl || process.env.AETHERGRID_OVERTURE_MAPS_URL);
  }

  async function request(params = {}, context = {}) {
    if (!configured()) {
      return {
        data: {
          status: 'unconfigured',
          message: 'Overture Maps provider is not configured on this server.',
          buildings: [],
          places: [],
          live: false,
        },
        receipt: {
          provider: 'overture',
          capability: 'geo',
          dataset: 'overture-city-data',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'Overture Maps Foundation (Unconfigured)',
        },
      };
    }

    if (!validateHttpsUrl(baseUrl)) {
      throw new Error(`Invalid Overture base URL '${baseUrl}'. Remote URLs must use HTTPS.`);
    }

    const lat = Number(params.lat ?? params.latitude);
    const lon = Number(params.lon ?? params.longitude);
    const radiusM = Math.max(100, Math.min(10000, Number(params.radiusM || params.radius) || 1000));

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error('Valid latitude (-90..90) and longitude (-180..180) are required for Overture query.');
    }

    const queryParams = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      radius: String(radiusM),
    });
    if (apiKey) queryParams.set('api_key', apiKey.trim());

    const endpointUrl = `${baseUrl}/buildings?${queryParams.toString()}`;

    const fetcher = async ({ signal } = {}) => {
      let rawJson;
      if (typeof options.fetchFn === 'function') {
        rawJson = await options.fetchFn(endpointUrl);
      } else {
        const headers = { accept: 'application/json' };
        if (apiKey) headers.authorization = `Bearer ${apiKey.trim()}`;
        const resp = await fetch(endpointUrl, { headers, signal });
        if (!resp.ok) throw new Error(`Overture Maps API HTTP ${resp.status}`);
        rawJson = await resp.json();
      }

      const features = Array.isArray(rawJson?.features)
        ? rawJson.features
        : Array.isArray(rawJson)
          ? rawJson
          : [];

      const buildings = features.map((f, idx) => ({
        id: f.id || `ov-bldg-${idx}`,
        type: 'building',
        name: f.properties?.name || f.properties?.names?.primary || null,
        heightM: Number(f.properties?.height) || null,
        numFloors: Number(f.properties?.num_floors) || null,
        geometry: f.geometry || null,
      }));

      return {
        coordinate: { lat, lon },
        radiusM,
        featureCount: buildings.length,
        buildings,
        status: 'Overture City Data Retrieved',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      const exec = await context.executeProviderRequest(
        'overture',
        {
          url: endpointUrl,
          capability: 'geo',
          dataset: 'overture-city-data',
          requestId: params.requestId || context.requestId,
          ttlMs: 900000,
          attribution: '© Overture Maps Foundation',
        },
        fetcher,
      );
      return { data: exec.data, receipt: exec.receipt };
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'overture',
        capability: 'geo',
        dataset: 'overture-city-data',
        requestId: params.requestId || context.requestId,
        live: true,
        attribution: '© Overture Maps Foundation',
      },
    };
  }

  return createProviderAdapter({
    id: 'overture',
    name: 'Overture Maps Foundation City Data Provider',
    capability: 'geo',
    capabilities: ['geo', 'buildings', 'places'],
    configured,
    request,
  });
}
