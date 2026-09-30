import { createHash } from 'node:crypto';

const CITY_PRESETS = Object.freeze([
  { id: 'new-york', name: 'New York', country: 'United States', lat: 40.7128, lon: -74.006, radiusM: 900 },
  { id: 'london', name: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278, radiusM: 900 },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, radiusM: 900 },
  { id: 'dubai', name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lon: 55.2708, radiusM: 900 },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198, radiusM: 900 },
  { id: 'sao-paulo', name: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6333, radiusM: 900 },
  { id: 'lagos', name: 'Lagos', country: 'Nigeria', lat: 6.5244, lon: 3.3792, radiusM: 900 },
  { id: 'sydney', name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093, radiusM: 900 },
]);

function numericHeight(tags = {}, id = 'building') {
  const explicit = Number.parseFloat(String(tags.height || '').replace(/[^0-9.]/gu, ''));
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(450, explicit);
  const levels = Number.parseFloat(String(tags['building:levels'] || ''));
  if (Number.isFinite(levels) && levels > 0) return Math.min(450, levels * 3.2);
  const hash = createHash('sha256').update(String(id)).digest();
  return 8 + (hash[0] / 255) * 34;
}

function projectPoint(lat, lon, center) {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLon = Math.cos((center.lat * Math.PI) / 180) * 111_320;
  return [
    (lon - center.lon) * metersPerDegreeLon,
    (lat - center.lat) * metersPerDegreeLat,
  ];
}

function seededFallback(city, count = 110) {
  let seed = createHash('sha256').update(city.id).digest().readUInt32LE(0);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, index) => {
    const x = (random() - 0.5) * 1500;
    const z = (random() - 0.5) * 1500;
    const w = 12 + random() * 42;
    const d = 12 + random() * 42;
    return {
      id: `fallback-${index + 1}`,
      name: '',
      heightM: 10 + random() * 95,
      footprint: [
        [x - w, z - d],
        [x + w, z - d],
        [x + w, z + d],
        [x - w, z + d],
        [x - w, z - d],
      ],
    };
  });
}

function parseOverpassBuildings(payload, city) {
  const buildings = [];
  for (const element of payload?.elements || []) {
    if (element.type !== 'way' || !Array.isArray(element.geometry) || element.geometry.length < 4) continue;
    const footprint = element.geometry
      .map((point) => projectPoint(Number(point.lat), Number(point.lon), city))
      .filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z));
    if (footprint.length < 4) continue;
    const first = footprint[0];
    const last = footprint.at(-1);
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.01) footprint.push([...first]);
    buildings.push({
      id: `osm-way-${element.id}`,
      osmId: element.id,
      name: String(element.tags?.name || ''),
      heightM: numericHeight(element.tags, element.id),
      levels: Number(element.tags?.['building:levels']) || null,
      buildingType: String(element.tags?.building || 'yes'),
      footprint,
    });
    if (buildings.length >= 350) break;
  }
  return buildings;
}

function validateEndpoint(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Overpass URL must be HTTP(S)');
  return url;
}

export function createGeoRuntime({
  env = process.env,
  fetchImpl = fetch,
  now = () => Date.now(),
} = {}) {
  const provider = String(env.AETHERGRID_GEO_PROVIDER || 'osm-overpass').toLowerCase();
  const endpoint = String(env.AETHERGRID_OVERPASS_URL || 'https://overpass-api.de/api/interpreter');
  const userAgent = String(
    env.AETHERGRID_GEO_USER_AGENT ||
      'AETHERGRID/2.2 (operator-console; contact configured by deployment owner)',
  );
  const cacheTtlMs = Math.max(60_000, Number(env.AETHERGRID_GEO_CACHE_TTL_MS || 900_000));
  const cache = new Map();

  function summary() {
    return {
      provider,
      liveProviderConfigured: provider === 'osm-overpass',
      endpoint: provider === 'osm-overpass' ? new URL(endpoint).origin : null,
      cacheTtlMs,
      attribution: '© OpenStreetMap contributors',
      cities: CITY_PRESETS,
    };
  }

  async function cityMesh(cityId, { force = false } = {}) {
    const city = CITY_PRESETS.find((item) => item.id === cityId);
    if (!city) {
      const error = new Error(`unknown city: ${cityId}`);
      error.status = 404;
      throw error;
    }
    const cached = cache.get(cityId);
    if (!force && cached && now() - cached.cachedAt < cacheTtlMs) return cached.value;

    if (provider !== 'osm-overpass') {
      return {
        schemaVersion: 1,
        city,
        source: { provider: 'local-fallback', live: false, attribution: null },
        buildings: seededFallback(city),
      };
    }

    try {
      const apiUrl = validateEndpoint(endpoint);
      const query = `[out:json][timeout:25];way["building"](around:${city.radiusM},${city.lat},${city.lon});out tags geom;`;
      const response = await fetchImpl(apiUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'user-agent': userAgent,
          accept: 'application/json',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
      const payload = await response.json();
      const buildings = parseOverpassBuildings(payload, city);
      if (buildings.length < 5) throw new Error('Overpass returned too few building footprints');
      const value = {
        schemaVersion: 1,
        city,
        source: {
          provider: 'OpenStreetMap Overpass',
          live: true,
          attribution: '© OpenStreetMap contributors',
          fetchedAt: new Date().toISOString(),
        },
        buildings,
      };
      cache.set(cityId, { cachedAt: now(), value });
      return value;
    } catch (error) {
      return {
        schemaVersion: 1,
        city,
        source: {
          provider: 'local-fallback',
          live: false,
          attribution: 'Live OpenStreetMap geometry unavailable for this request.',
          error: error instanceof Error ? error.message : String(error),
        },
        buildings: seededFallback(city),
      };
    }
  }

  return { summary, cityMesh, cities: CITY_PRESETS };
}

export { CITY_PRESETS };
