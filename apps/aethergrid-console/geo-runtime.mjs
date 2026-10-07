import { createHash } from 'node:crypto';

const DEFAULT_OVERPASS_ENDPOINTS = Object.freeze([
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]);

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

function projectGeometry(geometry = [], city, { close = false } = {}) {
  const path = geometry
    .map((point) => projectPoint(Number(point.lat), Number(point.lon), city))
    .filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z));
  if (close && path.length >= 3) {
    const first = path[0];
    const last = path.at(-1);
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.01) path.push([...first]);
  }
  return path;
}

function parseOverpassWater(payload, city) {
  const waterAreas = [];
  const waterways = [];
  const coastlines = [];
  const linearWaterways = new Set(['river', 'canal', 'stream', 'tidal_channel']);

  for (const element of payload?.elements || []) {
    const tags = element.tags || {};
    const natural = String(tags.natural || '');
    const waterway = String(tags.waterway || '');

    if (natural === 'water' || waterway === 'riverbank') {
      for (const geometry of buildingGeometries(element)) {
        const footprint = projectGeometry(geometry, city, { close: true });
        if (footprint.length < 4) continue;
        waterAreas.push({
          id: `osm-water-${element.type}-${element.id}-${waterAreas.length + 1}`,
          osmId: element.id,
          name: String(tags.name || tags['waterway:name'] || ''),
          waterType: String(tags.water || waterway || 'water'),
          intermittent: String(tags.intermittent || '') === 'yes',
          footprint,
        });
        if (waterAreas.length >= 140) break;
      }
    }

    if (
      element.type === 'way' &&
      linearWaterways.has(waterway) &&
      Array.isArray(element.geometry)
    ) {
      const path = projectGeometry(element.geometry, city);
      if (path.length >= 2 && waterways.length < 180) {
        waterways.push({
          id: `osm-waterway-${element.id}`,
          osmId: element.id,
          name: String(tags.name || ''),
          waterwayType: waterway,
          tidal: String(tags.tidal || '') === 'yes',
          path,
        });
      }
    }

    if (
      element.type === 'way' &&
      natural === 'coastline' &&
      Array.isArray(element.geometry)
    ) {
      const path = projectGeometry(element.geometry, city);
      if (path.length >= 2 && coastlines.length < 120) {
        coastlines.push({
          id: `osm-coastline-${element.id}`,
          osmId: element.id,
          path,
        });
      }
    }
  }

  return { waterAreas, waterways, coastlines };
}

function parseOverpassGreen(payload, city) {
  const greenAreas = [];
  const leisureTypes = new Set(['park', 'garden', 'nature_reserve']);
  const landuseTypes = new Set(['grass', 'recreation_ground', 'meadow']);
  const naturalTypes = new Set(['wood', 'grassland']);

  for (const element of payload?.elements || []) {
    const tags = element.tags || {};
    const leisure = String(tags.leisure || '');
    const landuse = String(tags.landuse || '');
    const natural = String(tags.natural || '');
    if (
      !leisureTypes.has(leisure) &&
      !landuseTypes.has(landuse) &&
      !naturalTypes.has(natural)
    ) {
      continue;
    }

    for (const geometry of buildingGeometries(element)) {
      const footprint = projectGeometry(geometry, city, { close: true });
      if (footprint.length < 4) continue;
      greenAreas.push({
        id: `osm-green-${element.type}-${element.id}-${greenAreas.length + 1}`,
        osmId: element.id,
        name: String(tags.name || ''),
        greenType: leisure || landuse || natural || 'green',
        footprint,
      });
      if (greenAreas.length >= 180) break;
    }
    if (greenAreas.length >= 180) break;
  }

  return greenAreas;
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
  const explicitEndpoint = String(env.AETHERGRID_OVERPASS_URL || '').trim();
  const configuredEndpointList = String(env.AETHERGRID_OVERPASS_URLS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const endpoints = Object.freeze(
    explicitEndpoint
      ? [explicitEndpoint]
      : configuredEndpointList.length
        ? configuredEndpointList
        : [...DEFAULT_OVERPASS_ENDPOINTS],
  );
  const endpoint = endpoints[0];
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
      endpoints:
        provider === 'osm-overpass'
          ? endpoints.map((value) => new URL(value).origin)
          : [],
      cacheTtlMs,
      attribution: '© OpenStreetMap contributors',
      cities: CITY_PRESETS,
      supportsCustomCoordinates: true,
      layers: [
        'buildings',
        'building-parts',
        'roofs',
        'roads',
        'power-lines',
        'power-assets',
        'water-areas',
        'waterways',
        'coastline',
        'green-areas',
      ],
      skylineFields: ['height', 'est_height', 'building:levels', 'min_height', 'building:min_level', 'roof:shape', 'roof:height', 'roof:levels', 'building:material', 'building:colour', 'roof:material', 'roof:colour'],
      upstreamFreshness: 'OpenStreetMap replication-backed upstream state when queried',
    };
  }

  async function requestOverpass(query, { timeoutMs = 18_000 } = {}) {
    let lastError = null;

    for (const candidate of endpoints) {
      try {
        const apiUrl = validateEndpoint(candidate);
        const response = await fetchImpl(apiUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'user-agent': userAgent,
            accept: 'application/json',
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
        return {
          payload: await response.json(),
          endpoint: apiUrl.toString(),
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('No Overpass endpoint was available');
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
        schemaVersion: 4,
        city,
        source,
        buildings,
        skylineProfile: skylineProfile(city, buildings, source),
        roads: fallbackRoads(city),
        waterAreas: [],
        waterways: [],
        coastlines: [],
        greenAreas: [],
        ...power,
      };
    }

    try {
      const buildingQuery =
        `[out:json][timeout:16];(` +
        `nwr["building"](around:${city.radiusM},${city.lat},${city.lon});` +
        `nwr["building:part"](around:${city.radiusM},${city.lat},${city.lon});` +
        `);out tags geom center;`;
      const contextQuery =
        `[out:json][timeout:12];(` +
        `way["highway"](around:${city.radiusM},${city.lat},${city.lon});` +
        `nwr["natural"="water"](around:${city.radiusM},${city.lat},${city.lon});` +
        `way["natural"="coastline"](around:${city.radiusM},${city.lat},${city.lon});` +
        `way["waterway"~"^(river|canal|stream|tidal_channel)$"](around:${city.radiusM},${city.lat},${city.lon});` +
        `nwr["leisure"~"^(park|garden|nature_reserve)$"](around:${city.radiusM},${city.lat},${city.lon});` +
        `nwr["landuse"~"^(grass|recreation_ground|meadow)$"](around:${city.radiusM},${city.lat},${city.lon});` +
        `nwr["natural"~"^(wood|grassland)$"](around:${city.radiusM},${city.lat},${city.lon});` +
        `way["power"~"^(line|minor_line|cable)$"](around:${city.radiusM},${city.lat},${city.lon});` +
        `nwr["power"~"^(substation|plant|generator|transformer)$"](around:${city.radiusM},${city.lat},${city.lon});` +
        `);out tags geom center;`;

      const buildingResult = await requestOverpass(buildingQuery, {
        timeoutMs: 18_000,
      });
      const buildings = parseOverpassBuildings(buildingResult.payload, city);
      if (buildings.length < 5) {
        throw new Error('Overpass returned too few building footprints');
      }

      const contextResult = await requestOverpass(contextQuery, {
        timeoutMs: 14_000,
      }).catch(() => null);
      const contextPayload = contextResult?.payload ?? { elements: [] };
      const roads = parseOverpassRoads(contextPayload, city);
      const water = parseOverpassWater(contextPayload, city);
      const greenAreas = parseOverpassGreen(contextPayload, city);
      const power = parseOverpassPower(contextPayload, city);

      const source = {
        provider: 'OpenStreetMap Overpass',
        live: true,
        partial: contextResult == null,
        attribution: '© OpenStreetMap contributors',
        fetchedAt: new Date().toISOString(),
        upstreamTimestamp:
          contextResult?.payload?.osm3s?.timestamp_osm_base ||
          buildingResult.payload?.osm3s?.timestamp_osm_base ||
          null,
        endpoint: new URL(buildingResult.endpoint).origin,
        freshnessModel: 'OpenStreetMap upstream database at request time',
      };
      const value = {
        schemaVersion: 4,
        city,
        source,
        buildings,
        skylineProfile: skylineProfile(city, buildings, source),
        roads,
        ...water,
        greenAreas,
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
        schemaVersion: 4,
        city,
        source,
        buildings,
        skylineProfile: skylineProfile(city, buildings, source),
        roads: fallbackRoads(city),
        waterAreas: [],
        waterways: [],
        coastlines: [],
        greenAreas: [],
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
