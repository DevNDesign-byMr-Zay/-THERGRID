import { createHash } from 'node:crypto';

const CITY_PRESETS = Object.freeze([
  {
    id: 'new-york',
    name: 'New York',
    country: 'United States',
    lat: 40.7128,
    lon: -74.006,
    radiusM: 900,
  },
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    lat: 51.5074,
    lon: -0.1278,
    radiusM: 900,
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    lat: 35.6762,
    lon: 139.6503,
    radiusM: 900,
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    lat: 25.2048,
    lon: 55.2708,
    radiusM: 900,
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    radiusM: 900,
  },
  {
    id: 'sao-paulo',
    name: 'São Paulo',
    country: 'Brazil',
    lat: -23.5505,
    lon: -46.6333,
    radiusM: 900,
  },
  {
    id: 'lagos',
    name: 'Lagos',
    country: 'Nigeria',
    lat: 6.5244,
    lon: 3.3792,
    radiusM: 900,
  },
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    lat: -33.8688,
    lon: 151.2093,
    radiusM: 900,
  },
]);

const POWER_LINE_TYPES = new Set(['line', 'minor_line', 'cable']);
const POWER_ASSET_TYPES = new Set(['substation', 'plant', 'generator', 'transformer']);

function numericHeight(tags = {}, id = 'building') {
  const explicit = Number.parseFloat(String(tags.height || '').replace(/[^0-9.]/gu, ''));
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(450, explicit);
  const levels = Number.parseFloat(String(tags['building:levels'] || ''));
  if (Number.isFinite(levels) && levels > 0) return Math.min(450, levels * 3.2);
  const hash = createHash('sha256').update(String(id)).digest();
  return 8 + (hash[0] / 255) * 34;
}

function numericMinHeight(tags = {}) {
  const explicit = Number.parseFloat(String(tags.min_height || '').replace(/[^0-9.]/gu, ''));
  if (Number.isFinite(explicit) && explicit >= 0) return Math.min(300, explicit);
  const minLevel = Number.parseFloat(String(tags['building:min_level'] || ''));
  if (Number.isFinite(minLevel) && minLevel > 0) return Math.min(300, minLevel * 3.2);
  return 0;
}

function numericVoltage(value) {
  const candidates = String(value || '')
    .split(';')
    .map((item) => Number.parseInt(item.replace(/[^0-9]/gu, ''), 10))
    .filter(Number.isFinite);
  return candidates.length ? Math.max(...candidates) : null;
}

function projectPoint(lat, lon, center) {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLon = Math.cos((center.lat * Math.PI) / 180) * 111_320;
  return [
    (lon - center.lon) * metersPerDegreeLon,
    (lat - center.lat) * metersPerDegreeLat,
  ];
}

function seededRandom(seedText) {
  let seed = createHash('sha256').update(seedText).digest().readUInt32LE(0);
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function seededFallback(city, count = 110) {
  const random = seededRandom(city.id);
  return Array.from({ length: count }, (_, index) => {
    const x = (random() - 0.5) * 1500;
    const z = (random() - 0.5) * 1500;
    const width = 12 + random() * 42;
    const depth = 12 + random() * 42;
    return {
      id: `fallback-${index + 1}`,
      name: '',
      heightM: 10 + random() * 95,
      footprint: [
        [x - width, z - depth],
        [x + width, z - depth],
        [x + width, z + depth],
        [x - width, z + depth],
        [x - width, z - depth],
      ],
    };
  });
}

function fallbackRoads(city, count = 20) {
  const random = seededRandom(`${city.id}:roads`);
  return Array.from({ length: count }, (_, index) => {
    const horizontal = index % 2 === 0;
    const offset = (random() - 0.5) * 1250;
    const wobble = (random() - 0.5) * 90;
    return {
      id: `fallback-road-${index + 1}`,
      name: '',
      highwayType: index % 5 === 0 ? 'primary' : 'residential',
      path: horizontal
        ? [
            [-720, offset],
            [-260, offset + wobble],
            [260, offset - wobble],
            [720, offset],
          ]
        : [
            [offset, -720],
            [offset + wobble, -260],
            [offset - wobble, 260],
            [offset, 720],
          ],
    };
  });
}

function fallbackPower(city) {
  const random = seededRandom(`${city.id}:power`);
  const powerAssets = Array.from({ length: 9 }, (_, index) => ({
    id: `fallback-power-asset-${index + 1}`,
    name: index % 3 === 0 ? `Local Substation ${index + 1}` : '',
    powerType: index % 3 === 0 ? 'substation' : 'transformer',
    voltage: index % 3 === 0 ? 138000 : 13800,
    operator: '',
    position: [(random() - 0.5) * 1300, (random() - 0.5) * 1300],
  }));
  const powerLines = Array.from({ length: 8 }, (_, index) => {
    const horizontal = index % 2 === 0;
    const offset = (random() - 0.5) * 1050;
    return {
      id: `fallback-power-line-${index + 1}`,
      name: '',
      powerType: index % 4 === 0 ? 'line' : 'minor_line',
      voltage: index % 4 === 0 ? 138000 : 33000,
      operator: '',
      path: horizontal
        ? [
            [-700, offset],
            [-180, offset + (random() - 0.5) * 80],
            [280, offset + (random() - 0.5) * 80],
            [700, offset],
          ]
        : [
            [offset, -700],
            [offset + (random() - 0.5) * 80, -180],
            [offset + (random() - 0.5) * 80, 280],
            [offset, 700],
          ],
    };
  });
  return { powerLines, powerAssets };
}

function parseOverpassBuildings(payload, city) {
  const buildings = [];
  const seen = new Set();
  for (const element of payload?.elements || []) {
    if (
      element.type !== 'way' ||
      !(element.tags?.building || element.tags?.['building:part']) ||
      !Array.isArray(element.geometry) ||
      element.geometry.length < 4
    ) {
      continue;
    }
    if (seen.has(element.id)) continue;
    seen.add(element.id);
    const footprint = element.geometry
      .map((point) => projectPoint(Number(point.lat), Number(point.lon), city))
      .filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z));
    if (footprint.length < 4) continue;
    const first = footprint[0];
    const last = footprint.at(-1);
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.01) {
      footprint.push([...first]);
    }
    buildings.push({
      id: `osm-way-${element.id}`,
      osmId: element.id,
      name: String(element.tags?.name || ''),
      heightM: numericHeight(element.tags, element.id),
      minHeightM: numericMinHeight(element.tags),
      levels: Number(element.tags?.['building:levels']) || null,
      buildingType: String(element.tags?.building || element.tags?.['building:part'] || 'yes'),
      buildingPart: Boolean(element.tags?.['building:part']),
      footprint,
    });
    if (buildings.length >= 350) break;
  }
  return buildings;
}

function parseOverpassRoads(payload, city) {
  const roads = [];
  for (const element of payload?.elements || []) {
    if (
      element.type !== 'way' ||
      !element.tags?.highway ||
      !Array.isArray(element.geometry) ||
      element.geometry.length < 2
    ) {
      continue;
    }
    const path = element.geometry
      .map((point) => projectPoint(Number(point.lat), Number(point.lon), city))
      .filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z));
    if (path.length < 2) continue;
    roads.push({
      id: `osm-road-${element.id}`,
      osmId: element.id,
      name: String(element.tags?.name || ''),
      highwayType: String(element.tags.highway),
      path,
    });
    if (roads.length >= 260) break;
  }
  return roads;
}

function elementCoordinate(element) {
  if (Number.isFinite(Number(element.lat)) && Number.isFinite(Number(element.lon))) {
    return [Number(element.lat), Number(element.lon)];
  }
  if (
    Number.isFinite(Number(element.center?.lat)) &&
    Number.isFinite(Number(element.center?.lon))
  ) {
    return [Number(element.center.lat), Number(element.center.lon)];
  }
  if (Array.isArray(element.geometry) && element.geometry.length) {
    const points = element.geometry
      .map((point) => [Number(point.lat), Number(point.lon)])
      .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
    if (!points.length) return null;
    return [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ];
  }
  return null;
}

function parseOverpassPower(payload, city) {
  const powerLines = [];
  const powerAssets = [];

  for (const element of payload?.elements || []) {
    const powerType = String(element.tags?.power || '');
    if (
      element.type === 'way' &&
      POWER_LINE_TYPES.has(powerType) &&
      Array.isArray(element.geometry) &&
      element.geometry.length >= 2
    ) {
      const path = element.geometry
        .map((point) => projectPoint(Number(point.lat), Number(point.lon), city))
        .filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z));
      if (path.length >= 2) {
        powerLines.push({
          id: `osm-power-line-${element.id}`,
          osmId: element.id,
          name: String(element.tags?.name || element.tags?.ref || ''),
          powerType,
          voltage: numericVoltage(element.tags?.voltage),
          operator: String(element.tags?.operator || ''),
          circuits: Number(element.tags?.circuits) || null,
          path,
        });
      }
    }

    if (POWER_ASSET_TYPES.has(powerType)) {
      const coordinate = elementCoordinate(element);
      if (!coordinate) continue;
      powerAssets.push({
        id: `osm-power-asset-${element.type}-${element.id}`,
        osmId: element.id,
        name: String(element.tags?.name || element.tags?.ref || ''),
        powerType,
        voltage: numericVoltage(element.tags?.voltage),
        operator: String(element.tags?.operator || ''),
        position: projectPoint(coordinate[0], coordinate[1], city),
      });
    }

    if (powerLines.length >= 180 && powerAssets.length >= 180) break;
  }

  return {
    powerLines: powerLines.slice(0, 180),
    powerAssets: powerAssets.slice(0, 180),
  };
}

function validateEndpoint(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Overpass URL must be HTTP(S)');
  }
  return url;
}

function normalizeCustomCity(input = {}) {
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    const error = new Error('latitude must be between -90 and 90');
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    const error = new Error('longitude must be between -180 and 180');
    error.status = 400;
    throw error;
  }
  const radiusM = Math.max(250, Math.min(2000, Number(input.radiusM) || 900));
  const name = String(input.name || 'Coordinate Explorer').trim().slice(0, 80);
  const id = `coord-${lat.toFixed(5)}-${lon.toFixed(5)}`;
  return {
    id,
    name: name || 'Coordinate Explorer',
    country: 'Custom coordinate',
    lat,
    lon,
    radiusM,
    custom: true,
  };
}

export function createGeoRuntime({
  env = process.env,
  fetchImpl = fetch,
  now = () => Date.now(),
} = {}) {
  const provider = String(env.AETHERGRID_GEO_PROVIDER || 'osm-overpass').toLowerCase();
  const endpoint = String(
    env.AETHERGRID_OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
  );
  const userAgent = String(
    env.AETHERGRID_GEO_USER_AGENT ||
      'AETHERGRID/2.3 (operator-console; contact configured by deployment owner)',
  );
  const cacheTtlMs = Math.max(
    60_000,
    Number(env.AETHERGRID_GEO_CACHE_TTL_MS || 900_000),
  );
  const cache = new Map();

  function summary() {
    return {
      provider,
      liveProviderConfigured: provider === 'osm-overpass',
      endpoint: provider === 'osm-overpass' ? new URL(endpoint).origin : null,
      cacheTtlMs,
      attribution: '© OpenStreetMap contributors',
      cities: CITY_PRESETS,
      supportsCustomCoordinates: true,
      layers: ['buildings', 'building-parts', 'roads', 'power-lines', 'power-assets'],
    };
  }

  async function meshForCity(city, { force = false } = {}) {
    const cacheKey = `${city.id}:${city.lat.toFixed(5)}:${city.lon.toFixed(5)}:${city.radiusM}`;
    const cached = cache.get(cacheKey);
    if (!force && cached && now() - cached.cachedAt < cacheTtlMs) return cached.value;

    if (provider !== 'osm-overpass') {
      const power = fallbackPower(city);
      return {
        schemaVersion: 2,
        city,
        source: { provider: 'local-fallback', live: false, attribution: null },
        buildings: seededFallback(city),
        roads: fallbackRoads(city),
        ...power,
      };
    }

    try {
      const apiUrl = validateEndpoint(endpoint);
      const query =
        `[out:json][timeout:25];(` +
        `way["building"](around:${city.radiusM},${city.lat},${city.lon});` +
        `way["building:part"](around:${city.radiusM},${city.lat},${city.lon});` +
        `way["highway"](around:${city.radiusM},${city.lat},${city.lon});` +
        `way["power"~"^(line|minor_line|cable)$"](around:${city.radiusM},${city.lat},${city.lon});` +
        `nwr["power"~"^(substation|plant|generator|transformer)$"](around:${city.radiusM},${city.lat},${city.lon});` +
        `);out tags geom center;`;
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
      const roads = parseOverpassRoads(payload, city);
      const power = parseOverpassPower(payload, city);
      if (buildings.length < 5) {
        throw new Error('Overpass returned too few building footprints');
      }
      const value = {
        schemaVersion: 2,
        city,
        source: {
          provider: 'OpenStreetMap Overpass',
          live: true,
          attribution: '© OpenStreetMap contributors',
          fetchedAt: new Date().toISOString(),
        },
        buildings,
        roads,
        ...power,
      };
      cache.set(cacheKey, { cachedAt: now(), value });
      return value;
    } catch (error) {
      const power = fallbackPower(city);
      return {
        schemaVersion: 2,
        city,
        source: {
          provider: 'local-fallback',
          live: false,
          attribution: 'Live OpenStreetMap geometry unavailable for this request.',
          error: error instanceof Error ? error.message : String(error),
        },
        buildings: seededFallback(city),
        roads: fallbackRoads(city),
        ...power,
      };
    }
  }

  async function cityMesh(cityId, options = {}) {
    const city = CITY_PRESETS.find((item) => item.id === cityId);
    if (!city) {
      const error = new Error(`unknown city: ${cityId}`);
      error.status = 404;
      throw error;
    }
    return meshForCity(city, options);
  }

  async function pointMesh(input = {}, options = {}) {
    return meshForCity(normalizeCustomCity(input), options);
  }

  return {
    summary,
    cityMesh,
    pointMesh,
    cities: CITY_PRESETS,
  };
}

export { CITY_PRESETS };
