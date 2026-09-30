import { createHash } from 'node:crypto';

const CITY_PRESETS = Object.freeze([
  {
    id: 'new-york',
    name: 'New York',
    country: 'United States',
    district: 'Midtown Manhattan',
    lat: 40.7549,
    lon: -73.984,
    radiusM: 1600,
  },
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    district: 'City of London / South Bank',
    lat: 51.5136,
    lon: -0.0917,
    radiusM: 1700,
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    district: 'Shinjuku',
    lat: 35.6896,
    lon: 139.6917,
    radiusM: 1700,
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    district: 'Downtown Dubai',
    lat: 25.1972,
    lon: 55.2744,
    radiusM: 1800,
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    district: 'Marina Bay / Downtown Core',
    lat: 1.2838,
    lon: 103.8515,
    radiusM: 1700,
  },
  {
    id: 'sao-paulo',
    name: 'São Paulo',
    country: 'Brazil',
    district: 'Paulista / Bela Vista',
    lat: -23.5614,
    lon: -46.6559,
    radiusM: 1700,
  },
  {
    id: 'lagos',
    name: 'Lagos',
    country: 'Nigeria',
    district: 'Victoria Island / Eko Atlantic',
    lat: 6.4281,
    lon: 3.4219,
    radiusM: 1800,
  },
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    district: 'CBD / Circular Quay',
    lat: -33.8651,
    lon: 151.2099,
    radiusM: 1700,
  },
]);

const POWER_LINE_TYPES = new Set(['line', 'minor_line', 'cable']);
const POWER_ASSET_TYPES = new Set(['substation', 'plant', 'generator', 'transformer']);

function parseMetricHeight(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  const numeric = Number.parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(numeric)) return null;
  if (/\b(ft|feet|foot)\b/u.test(raw) || /'\s*$/u.test(raw)) return numeric * 0.3048;
  return numeric;
}

function heightProfile(tags = {}, id = 'building') {
  const explicit = parseMetricHeight(tags.height);
  if (Number.isFinite(explicit) && explicit > 0) {
    return { heightM: Math.min(1200, explicit), source: 'height' };
  }
  const estimated = parseMetricHeight(tags.est_height);
  if (Number.isFinite(estimated) && estimated > 0) {
    return { heightM: Math.min(1200, estimated), source: 'est_height' };
  }
  const levels = Number.parseFloat(String(tags['building:levels'] || ''));
  if (Number.isFinite(levels) && levels > 0) {
    return { heightM: Math.min(1200, levels * 3.2), source: 'building:levels' };
  }
  const hash = createHash('sha256').update(String(id)).digest();
  return { heightM: 8 + (hash[0] / 255) * 34, source: 'inferred' };
}

function numericMinHeight(tags = {}) {
  const explicit = parseMetricHeight(tags.min_height);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.min(1200, explicit);
  const minLevel = Number.parseFloat(String(tags['building:min_level'] || ''));
  if (Number.isFinite(minLevel) && minLevel > 0) return Math.min(1200, minLevel * 3.2);
  return 0;
}

function numericRoofHeight(tags = {}) {
  const explicit = parseMetricHeight(tags['roof:height']);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.min(250, explicit);
  const levels = Number.parseFloat(String(tags['roof:levels'] || ''));
  if (Number.isFinite(levels) && levels > 0) return Math.min(250, levels * 3.2);
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
      heightSource: 'synthetic-fallback',
      minHeightM: 0,
      roofShape: '',
      roofHeightM: 0,
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

function buildingGeometries(element) {
  if (element.type === 'way' && Array.isArray(element.geometry)) return [element.geometry];
  if (element.type !== 'relation' || !Array.isArray(element.members)) return [];
  return element.members
    .filter((member) => member?.type === 'way' && member?.role !== 'inner' && Array.isArray(member.geometry))
    .map((member) => member.geometry);
}

function representativeBuildings(buildings, limit = 1400) {
  if (buildings.length <= limit) return buildings;
  const priority = [...buildings]
    .sort((left, right) => {
      const score = (building) =>
        (building.heightSource === 'height' ? 4000 : 0) +
        (building.heightSource === 'est_height' ? 3000 : 0) +
        (building.heightSource === 'building:levels' ? 2000 : 0) +
        (building.buildingPart ? 1000 : 0) +
        Number(building.heightM || 0);
      return score(right) - score(left);
    })
    .slice(0, Math.floor(limit * 0.58));
  const selected = new Set(priority.map((building) => building.id));
  const remainder = buildings.filter((building) => !selected.has(building.id));
  const need = limit - priority.length;
  const sampled = [];
  for (let index = 0; index < need; index += 1) {
    const position = Math.min(
      remainder.length - 1,
      Math.floor((index / Math.max(1, need - 1)) * Math.max(0, remainder.length - 1)),
    );
    const building = remainder[position];
    if (building && !selected.has(building.id)) {
      selected.add(building.id);
      sampled.push(building);
    }
  }
  return [...priority, ...sampled].slice(0, limit);
}

function percentile(values, amount) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * amount)));
  return sorted[index];
}

function skylineProfile(city, buildings, source = {}) {
  const heights = buildings
    .map((building) => Number(building.heightM || 0))
    .filter((height) => height > 0);
  const sourceBacked = buildings.filter(
    (building) =>
      building.heightSource !== 'inferred' &&
      building.heightSource !== 'synthetic-fallback',
  ).length;
  const roofTagged = buildings.filter(
    (building) => building.roofShape || building.roofHeightM > 0,
  ).length;
  const parts = buildings.filter((building) => building.buildingPart).length;
  const p95HeightM = Number(percentile(heights, 0.95).toFixed(1));
  const namedStructures = buildings
    .filter((building) => String(building.name || '').trim())
    .sort((left, right) => {
      const heightDelta = Number(right.heightM || 0) - Number(left.heightM || 0);
      if (heightDelta) return heightDelta;
      return String(left.name).localeCompare(String(right.name));
    })
    .slice(0, 16)
    .map((building) => ({
      id: building.id,
      name: String(building.name),
      heightM: Number(Number(building.heightM || 0).toFixed(1)),
      heightSource: building.heightSource || null,
      buildingType: building.buildingType || null,
      roofShape: building.roofShape || null,
      startDate: building.startDate || null,
      osmId: building.osmId || null,
      osmType: building.osmType || null,
    }));
  const tallStructureCount = buildings.filter(
    (building) => Number(building.heightM || 0) >= Math.max(80, p95HeightM),
  ).length;
  return {
    district: city.district || null,
    buildingCount: buildings.length,
    maxHeightM: Number(Math.max(0, ...heights).toFixed(1)),
    p95HeightM,
    medianHeightM: Number(percentile(heights, 0.5).toFixed(1)),
    sourceBackedHeightCoveragePercent: buildings.length
      ? Number(((sourceBacked / buildings.length) * 100).toFixed(1))
      : 0,
    buildingPartCount: parts,
    roofTaggedCount: roofTagged,
    namedStructureCount: buildings.filter((building) => String(building.name || '').trim()).length,
    tallStructureCount,
    namedStructures,
    upstreamTimestamp: source.upstreamTimestamp || null,
    sourceProvider: source.provider || null,
    live: Boolean(source.live),
  };
}

function parseOverpassBuildings(payload, city) {
  const buildings = [];
  const seen = new Set();
  for (const element of payload?.elements || []) {
    if (!(element.tags?.building || element.tags?.['building:part'])) continue;
    const geometries = buildingGeometries(element);
    if (!geometries.length) continue;
    geometries.forEach((geometry, geometryIndex) => {
      if (!Array.isArray(geometry) || geometry.length < 4) return;
      const uniqueId = `${element.type}-${element.id}-${geometryIndex}`;
      if (seen.has(uniqueId)) return;
      seen.add(uniqueId);
      const footprint = geometry
        .map((point) => projectPoint(Number(point.lat), Number(point.lon), city))
        .filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z));
      if (footprint.length < 4) return;
      const first = footprint[0];
      const last = footprint.at(-1);
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.01) {
        footprint.push([...first]);
      }
      const height = heightProfile(element.tags, uniqueId);
      buildings.push({
        id: `osm-${uniqueId}`,
        osmId: element.id,
        osmType: element.type,
        name: String(element.tags?.name || ''),
        heightM: height.heightM,
        heightSource: height.source,
        minHeightM: numericMinHeight(element.tags),
        levels: Number(element.tags?.['building:levels']) || null,
        buildingType: String(element.tags?.building || element.tags?.['building:part'] || 'yes'),
        buildingPart: Boolean(element.tags?.['building:part']),
        buildingMaterial: String(element.tags?.['building:material'] || ''),
        buildingColor: String(element.tags?.['building:colour'] || ''),
        roofShape: String(element.tags?.['roof:shape'] || ''),
        roofHeightM: numericRoofHeight(element.tags),
        roofLevels: Number(element.tags?.['roof:levels']) || null,
        roofMaterial: String(element.tags?.['roof:material'] || ''),
        roofColor: String(element.tags?.['roof:colour'] || ''),
        startDate: String(element.tags?.start_date || ''),
        footprint,
      });
    });
  }
  return representativeBuildings(buildings);
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

function parseOverpassUrbanFabric(payload, city) {
  const waterLines = [];
  const railLines = [];
  const transitAssets = [];
  const greenSpaces = [];

  for (const element of payload?.elements || []) {
    const tags = element.tags || {};
    const path =
      element.type === 'way' && Array.isArray(element.geometry)
        ? element.geometry
            .map((point) => projectPoint(Number(point.lat), Number(point.lon), city))
            .filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z))
        : [];

    const waterType =
      tags.natural === 'coastline'
        ? 'coastline'
        : tags.natural === 'water'
          ? String(tags.water || 'water')
          : tags.waterway
            ? String(tags.waterway)
            : '';
    if (waterType && path.length >= 2 && waterLines.length < 180) {
      waterLines.push({
        id: \`osm-water-\${element.id}\`,
        osmId: element.id,
        name: String(tags.name || ''),
        waterType,
        path,
      });
    }

    const railwayType = String(tags.railway || '');
    if (
      path.length >= 2 &&
      ['rail', 'subway', 'tram', 'light_rail', 'monorail'].includes(railwayType) &&
      railLines.length < 180
    ) {
      railLines.push({
        id: \`osm-rail-\${element.id}\`,
        osmId: element.id,
        name: String(tags.name || tags.ref || ''),
        railwayType,
        service: String(tags.service || ''),
        operator: String(tags.operator || ''),
        path,
      });
    }

    if (['station', 'halt', 'subway_entrance', 'tram_stop'].includes(railwayType)) {
      const coordinate = elementCoordinate(element);
      if (coordinate && transitAssets.length < 180) {
        transitAssets.push({
          id: \`osm-transit-\${element.type}-\${element.id}\`,
          osmId: element.id,
          osmType: element.type,
          name: String(tags.name || tags.ref || ''),
          railwayType,
          operator: String(tags.operator || ''),
          position: projectPoint(coordinate[0], coordinate[1], city),
        });
      }
    }

    const greenType =
      ['park', 'garden'].includes(String(tags.leisure || ''))
        ? String(tags.leisure)
        : ['grass', 'recreation_ground', 'village_green'].includes(String(tags.landuse || ''))
          ? String(tags.landuse)
          : ['wood', 'scrub', 'heath'].includes(String(tags.natural || ''))
            ? String(tags.natural)
            : '';
    if (greenType && path.length >= 3 && greenSpaces.length < 140) {
      greenSpaces.push({
        id: \`osm-green-\${element.id}\`,
        osmId: element.id,
        name: String(tags.name || ''),
        greenType,
        path,
      });
    }
  }

  return {
    waterLines,
    railLines,
    transitAssets,
    greenSpaces,
  };
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
      layers: [
        'buildings',
        'building-parts',
        'roofs',
        'roads',
        'water',
        'rail',
        'transit',
        'green-space',
        'power-lines',
        'power-assets',
      ],
      skylineFields: ['height', 'est_height', 'building:levels', 'min_height', 'building:min_level', 'roof:shape', 'roof:height', 'roof:levels', 'building:material', 'building:colour', 'roof:material', 'roof:colour'],
      upstreamFreshness: 'OpenStreetMap replication-backed upstream state when queried',
    };
  }

  async function meshForCity(city, { force = false } = {}) {
    const cacheKey = `${city.id}:${city.lat.toFixed(5)}:${city.lon.toFixed(5)}:${city.radiusM}`;
    const cached = cache.get(cacheKey);
    if (!force && cached && now() - cached.cachedAt < cacheTtlMs) return cached.value;

    if (provider !== 'osm-overpass') {
      const power = fallbackPower(city);
      const buildings = seededFallback(city);
      const source = { provider: 'local-fallback', live: false, attribution: null };
      return {
        schemaVersion: 3,
        city,
        source,
        buildings,
        skylineProfile: skylineProfile(city, buildings, source),
        roads: fallbackRoads(city),
        ...power,
      };
    }

    try {
      const apiUrl = validateEndpoint(endpoint);
      const query =
        `[out:json][timeout:25];(` +
        `nwr["building"](around:${city.radiusM},${city.lat},${city.lon});` +
        `nwr["building:part"](around:${city.radiusM},${city.lat},${city.lon});` +
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
      const source = {
        provider: 'OpenStreetMap Overpass',
        live: true,
        attribution: '© OpenStreetMap contributors',
        fetchedAt: new Date().toISOString(),
        upstreamTimestamp: payload?.osm3s?.timestamp_osm_base || null,
        freshnessModel: 'OpenStreetMap upstream database at request time',
      };
      const value = {
        schemaVersion: 3,
        city,
        source,
        buildings,
        skylineProfile: skylineProfile(city, buildings, source),
        roads,
        ...power,
      };
      cache.set(cacheKey, { cachedAt: now(), value });
      return value;
    } catch (error) {
      const power = fallbackPower(city);
      const buildings = seededFallback(city);
      const source = {
        provider: 'local-fallback',
        live: false,
        attribution: 'Live OpenStreetMap geometry unavailable for this request.',
        error: error instanceof Error ? error.message : String(error),
      };
      return {
        schemaVersion: 3,
        city,
        source,
        buildings,
        skylineProfile: skylineProfile(city, buildings, source),
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
