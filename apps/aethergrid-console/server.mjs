import { createRequestContext } from './providers/request-context.mjs';
import { createPublicConfig } from './config/public-config.mjs';
import { createTomorrowWeatherProvider } from './providers/tomorrow-weather-provider.mjs';
import { createNwsAlertsProvider } from './providers/nws-alerts-provider.mjs';
import { createNoaaNwpsHydrologyProvider } from './providers/noaa-nwps-provider.mjs';
import { createEiaProvider } from './providers/eia-provider.mjs';
import { createTransitRegistry } from './providers/transit-registry.mjs';
import { createDwaveProvider } from './providers/dwave-provider.mjs';
import { createProviderRegistry } from './providers/provider-registry.mjs';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAgentRuntime } from './ai-runtime.mjs';
import { createCityEnvironmentRuntime } from './city-environment-runtime.mjs';
import { createCityLiveRuntime } from './city-live-runtime.mjs';
import { createGeoRuntime } from './geo-runtime.mjs';
import { createProfileStore } from './profile-store.mjs';
import { createQuantumRuntime } from './quantum-runtime.mjs';
import { createTerrainRuntime } from './terrain-runtime.mjs';

const providerRegistry = createProviderRegistry({ env: process.env });

const tomorrowWeatherProvider = createTomorrowWeatherProvider({
  apiKey: providerRegistry.config.futureProviders.tomorrowIo.apiKey,
  baseUrl: providerRegistry.config.futureProviders.tomorrowIo.baseUrl,
});

const nwsAlertsProvider = createNwsAlertsProvider({
  baseUrl: providerRegistry.config.futureProviders.nws.apiUrl,
  userAgent: providerRegistry.config.geo.userAgent,
});

const eiaProvider = createEiaProvider({
  apiKey: providerRegistry.config.futureProviders.eia.apiKey,
  baseUrl: providerRegistry.config.futureProviders.eia.baseUrl,
});

const noaaNwpsProvider = createNoaaNwpsHydrologyProvider({
  baseUrl: providerRegistry.config.futureProviders.hydrology.baseUrl,
});

const dwaveProvider = createDwaveProvider({
  token: providerRegistry.config.futureProviders.dwave.token,
  solverUrl: providerRegistry.config.futureProviders.dwave.solverUrl,
});

const transitRegistry = createTransitRegistry();

const root = fileURLToPath(new URL('./', import.meta.url));
const port = Number(providerRegistry.config.app.port);

function createPipelineFetch(providerId) {
  return async (url, options) => {
    const targetUrl = typeof url === 'string' ? url : url.toString();
    providerRegistry.urlPolicy.validateUrl(targetUrl);

    const breaker = providerRegistry.getBreaker(providerId);
    const startTime = Date.now();
    try {
      const res = await fetch(url, options);
      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        providerRegistry.health.recordExecution(providerId, {
          success: true,
          latencyMs,
          circuitState: breaker.getState(),
        });
      } else {
        providerRegistry.health.recordExecution(providerId, {
          error: true,
          latencyMs,
          circuitState: breaker.getState(),
        });
      }
      return res;
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      providerRegistry.health.recordExecution(providerId, {
        error: true,
        latencyMs,
        circuitState: breaker.getState(),
      });
      throw err;
    }
  };
}

const agentRuntime = createAgentRuntime();
const cityEnvironmentRuntime = createCityEnvironmentRuntime({ fetchImpl: createPipelineFetch('weather') });
const cityLiveRuntime = createCityLiveRuntime({ fetchImpl: createPipelineFetch('air-quality') });
const geoRuntime = createGeoRuntime({ fetchImpl: createPipelineFetch('geo') });
const quantumRuntime = createQuantumRuntime();
const terrainRuntime = createTerrainRuntime({ fetchImpl: createPipelineFetch('terrain') });
const profileStore = createProfileStore({
  dataDir: process.env.AETHERGRID_DATA_DIR || join(root, '.aethergrid-data'),
});

const regions = Object.freeze([
  'New York Metro',
  'Long Island',
  'Hudson Valley',
  'Upstate New York',
]);

const scenarios = Object.freeze([
  'peak-demand',
  'renewable-surge',
  'storage-stress',
  'weather-event',
  'custom',
]);

const views = Object.freeze(['live', 'forecast', 'scenario']);

const state = {
  system: {
    status: 'All Systems Nominal',
    region: 'New York Metro',
    mode: 'ADVISORY ONLY',
    view: 'live',
    scenario: 'peak-demand',
    scenarioParameters: {
      loadMultiplierPercent: 110,
      renewableAvailabilityPercent: 100,
      storageReservePercent: 18,
      weatherRiskPercent: 20,
    },
    physicalActuation: false,
    infrastructureDispatch: false,
  },
  metrics: {
    generationMw: 2130,
    loadMw: 2410,
    renewablePercent: 46.8,
    storageMw: 590,
  },
  optimization: {
    currentCost: 12480,
    candidateCost: 10230,
    classicalCandidateCost: 11790,
    emissionsReduction: 24.3,
    renewableUtilizationGain: 16.7,
    reliabilityScore: 90.0,
    runCount: 0,
    history: [],
  },
  agents: {
    'VÆLON': {
      role: 'Optimization & Scenario Exploration',
      description:
        'Runs bounded multi-objective scenario exploration with renewable prioritization and classical-baseline comparison.',
      status: 'ONLINE',
    },
    AUREN: {
      role: 'Semantic Analysis & Spatial Intelligence',
      description:
        'Interprets grid-resilience patterns, spatial relationships, operator context, and evidence-linked meaning.',
      status: 'ONLINE',
    },
    'SOLVÆR': {
      role: 'Simulation & Evidence Generation',
      description:
        'Generates bounded simulations, validation evidence, provenance records, and candidate-comparison packages.',
      status: 'ONLINE',
    },
  },
  evidence: [
    { id: 'peak-load-reduction', title: 'Scenario: Peak Load Reduction', age: '12 min', status: 'VERIFIED' },
    { id: 'quantum-optimization', title: 'Quantum Optimization Run', age: '28 min', status: 'VERIFIED' },
    { id: 'grid-resilience', title: 'Grid Resilience Analysis', age: '1 hour', status: 'VERIFIED' },
    { id: 'renewable-integration', title: 'Renewable Integration Study', age: '2 hours', status: 'VERIFIED' },
  ],
  activity: [],
  externalContext: {
    geospatial: null,
    quantum: null,
  },
};

function buildSpatialGraph() {
  const nodes = [
    { id: 'renewables-west', label: 'Renewable Generation', type: 'generation', position: [-6, 0.35, -3], capacityMw: 2130 },
    { id: 'midtown-load', label: 'Grid Load', type: 'load', position: [-2, 0.55, 1], loadMw: 2410 },
    { id: 'battery-east', label: 'Energy Storage', type: 'storage', position: [2, 0.65, -2], capacityMw: 590 },
    { id: 'nyc-core', label: 'New York City', type: 'city', position: [5, 0.48, 3], loadMw: 1240 },
    { id: 'north-hub', label: 'North Hub', type: 'transmission', position: [0, 0.72, 5], capacityMw: 880 },
    { id: 'coastal-hub', label: 'Coastal Hub', type: 'transmission', position: [7, 0.38, -5], capacityMw: 720 },
    { id: 'west-hub', label: 'West Hub', type: 'transmission', position: [-7, 0.44, 5], capacityMw: 760 },
  ];
  const routeIndexes = [[0,1],[1,2],[2,3],[1,4],[3,5],[4,6],[6,0],[4,3],[2,5]];
  const routes = routeIndexes.map(([a,b], index) => ({
    id: `route-${index + 1}`,
    from: nodes[a].id,
    to: nodes[b].id,
    capacityMw: 480 + index * 55,
    phase: index * 0.57,
  }));
  let seed = 31;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const structures = Array.from({ length: 72 }, (_, index) => ({
    id: `structure-${index + 1}`,
    x: random() * 18 - 9,
    z: random() * 18 - 9,
    width: 0.28 + random() * 0.62,
    depth: 0.28 + random() * 0.62,
    height: 0.35 + random() * 2.8,
    temporalPhase: random() * Math.PI * 2,
  }));
  return {
    schemaVersion: 1,
    dimensions: ['x', 'y', 'z', 'time'],
    coordinateSystem: 'normalized-operator-grid',
    temporal: { minHour: 0, maxHour: 24, unit: 'hour' },
    nodes,
    routes,
    structures,
  };
}

const spatialGraph = buildSpatialGraph();
let activeCityMesh = null;

const CITY_USE_CASES = Object.freeze({
  'grid-resilience': Object.freeze({
    id: 'grid-resilience',
    label: 'Grid Resilience',
    purpose: 'Combine mapped electrical topology with current weather, seismic and built-environment context for resilience planning.',
    indexLabel: 'Resilience context index',
    agentLead: 'VÆLON',
    recommendedLayers: ['grid', 'infrastructure', 'nodes', 'terrain', 'buildings', 'weather', 'seismic'],
    animationProfile: 'grid-flow',
  }),
  'outage-impact': Object.freeze({
    id: 'outage-impact',
    label: 'Outage Impact',
    purpose: 'Estimate where dense built areas overlap mapped grid assets while current weather and seismic conditions are visible.',
    indexLabel: 'Exposure proxy index',
    agentLead: 'SOLVÆR',
    recommendedLayers: ['buildings', 'infrastructure', 'nodes', 'roads', 'weather'],
    animationProfile: 'exposure-pulse',
  }),
  'emergency-access': Object.freeze({
    id: 'emergency-access',
    label: 'Emergency Access',
    purpose: 'Inspect road-network reach, terrain and current precipitation/wind constraints around mapped infrastructure.',
    indexLabel: 'Access context index',
    agentLead: 'AUREN',
    recommendedLayers: ['roads', 'terrain', 'nodes', 'buildings', 'weather'],
    animationProfile: 'route-flow',
  }),
  'renewable-siting': Object.freeze({
    id: 'renewable-siting',
    label: 'Renewable Siting',
    purpose: 'Combine built form, terrain, grid proximity and current wind/solar model context for early-stage resource exploration.',
    indexLabel: 'Resource context index',
    agentLead: 'VÆLON',
    recommendedLayers: ['terrain', 'buildings', 'infrastructure', 'nodes', 'weather'],
    animationProfile: 'resource-flow',
  }),
  'load-growth': Object.freeze({
    id: 'load-growth',
    label: 'Load Growth',
    purpose: 'Use mapped building mass and grid proximity as a planning proxy while current atmospheric context remains visible.',
    indexLabel: 'Built-load proxy index',
    agentLead: 'AUREN',
    recommendedLayers: ['buildings', 'roads', 'infrastructure', 'nodes', 'grid'],
    animationProfile: 'building-pulse',
  }),
  'weather-readiness': Object.freeze({
    id: 'weather-readiness',
    label: 'Weather Readiness',
    purpose: 'Animate current wind, gust, precipitation, cloud and visibility context against the mapped city and grid.',
    indexLabel: 'Weather attention index',
    agentLead: 'SOLVÆR',
    recommendedLayers: ['weather', 'roads', 'infrastructure', 'nodes', 'buildings', 'terrain'],
    animationProfile: 'weather',
  }),
  'air-quality-exposure': Object.freeze({
    id: 'air-quality-exposure',
    label: 'Air Quality Exposure',
    purpose: 'Visualize current modeled AQI and particulate context against building density and road topology.',
    indexLabel: 'Air exposure context index',
    agentLead: 'AUREN',
    recommendedLayers: ['air', 'buildings', 'roads', 'nodes'],
    animationProfile: 'air-quality',
  }),
  'seismic-awareness': Object.freeze({
    id: 'seismic-awareness',
    label: 'Seismic Awareness',
    purpose: 'Place recent USGS M2.5+ events around the active city and compare their distance/magnitude with the built environment.',
    indexLabel: 'Seismic attention index',
    agentLead: 'SOLVÆR',
    recommendedLayers: ['seismic', 'buildings', 'terrain', 'roads', 'infrastructure'],
    animationProfile: 'seismic',
  }),
  'heat-stress': Object.freeze({
    id: 'heat-stress',
    label: 'Heat Stress',
    purpose: 'Combine current apparent temperature, humidity, UV and mapped built-form density for urban heat attention review.',
    indexLabel: 'Heat attention index',
    agentLead: 'AUREN',
    recommendedLayers: ['buildings', 'illumination', 'clouds', 'weather', 'air', 'nodes'],
    animationProfile: 'heat',
  }),
  'visibility-operations': Object.freeze({
    id: 'visibility-operations',
    label: 'Visibility Operations',
    purpose: 'Combine current visibility, precipitation, cloud and air-quality context with mapped roads and structures.',
    indexLabel: 'Visibility attention index',
    agentLead: 'SOLVÆR',
    recommendedLayers: ['roads', 'buildings', 'illumination', 'clouds', 'weather', 'air', 'nodes'],
    animationProfile: 'visibility',
  }),
  'flood-context': Object.freeze({
    id: 'flood-context',
    label: 'Flood Context',
    purpose: 'Compare mapped water/coastline, terrain, precipitation, roads and infrastructure as a bounded flood-attention planning surface.',
    indexLabel: 'Flood context index',
    agentLead: 'SOLVÆR',
    recommendedLayers: ['water', 'terrain', 'weather', 'roads', 'infrastructure', 'buildings', 'nodes'],
    animationProfile: 'flood-context',
  }),
  'green-infrastructure': Object.freeze({
    id: 'green-infrastructure',
    label: 'Green Infrastructure',
    purpose: 'Compare mapped parks and green areas with current heat, humidity, air quality and built-form density.',
    indexLabel: 'Green infrastructure need index',
    agentLead: 'AUREN',
    recommendedLayers: ['green', 'buildings', 'weather', 'air', 'landmarks', 'nodes'],
    animationProfile: 'green-infrastructure',
  }),
});

function planarLength(path = []) {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1];
    const b = path[index];
    if (!a || !b) continue;
    total += Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1]));
  }
  return total;
}

function polygonArea(path = []) {
  if (path.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < path.length; index += 1) {
    const a = path[index];
    const b = path[(index + 1) % path.length];
    area += Number(a?.[0] || 0) * Number(b?.[1] || 0) - Number(b?.[0] || 0) * Number(a?.[1] || 0);
  }
  return Math.abs(area) / 2;
}

function clampIndex(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function cityMeshMetrics(mesh) {
  const buildings = Array.isArray(mesh?.buildings) ? mesh.buildings : [];
  const roads = Array.isArray(mesh?.roads) ? mesh.roads : [];
  const powerLines = Array.isArray(mesh?.powerLines) ? mesh.powerLines : [];
  const powerAssets = Array.isArray(mesh?.powerAssets) ? mesh.powerAssets : [];
  const waterAreas = Array.isArray(mesh?.waterAreas) ? mesh.waterAreas : [];
  const waterways = Array.isArray(mesh?.waterways) ? mesh.waterways : [];
  const coastlines = Array.isArray(mesh?.coastlines) ? mesh.coastlines : [];
  const greenAreas = Array.isArray(mesh?.greenAreas) ? mesh.greenAreas : [];
  const radiusM = Math.max(250, Number(mesh?.city?.radiusM || 900));
  let footprintAreaM2 = 0;
  let estimatedFloorAreaM2 = 0;
  let heightTotalM = 0;
  for (const building of buildings) {
    const area = polygonArea(building.footprint || []);
    const minHeight = Math.max(0, Number(building.minHeightM || 0));
    const height = Math.max(minHeight + 3.2, Number(building.heightM || 12));
    const levels = Math.max(1, Number(building.levels) || Math.round((height - minHeight) / 3.2));
    footprintAreaM2 += area;
    estimatedFloorAreaM2 += area * levels;
    heightTotalM += height;
  }
  const roadLengthKm = roads.reduce((sum, road) => sum + planarLength(road.path || []), 0) / 1000;
  const primaryRoadKm = roads
    .filter((road) => /^(motorway|trunk|primary|secondary)$/u.test(String(road.highwayType || '')))
    .reduce((sum, road) => sum + planarLength(road.path || []), 0) / 1000;
  const powerLineKm = powerLines.reduce((sum, line) => sum + planarLength(line.path || []), 0) / 1000;
  const highVoltageKm = powerLines
    .filter((line) => Number(line.voltage || 0) >= 100000)
    .reduce((sum, line) => sum + planarLength(line.path || []), 0) / 1000;
  const substations = powerAssets.filter((asset) => asset.powerType === 'substation').length;
  const generationAssets = powerAssets.filter((asset) => ['plant', 'generator'].includes(asset.powerType)).length;
  const waterAreaM2 = waterAreas.reduce(
    (sum, feature) => sum + polygonArea(feature.footprint || []),
    0,
  );
  const waterwayLengthKm =
    [...waterways, ...coastlines].reduce(
      (sum, feature) => sum + planarLength(feature.path || []),
      0,
    ) / 1000;
  const greenAreaM2 = greenAreas.reduce(
    (sum, feature) => sum + polygonArea(feature.footprint || []),
    0,
  );
  const sourceHeightValues = buildings
    .filter(
      (building) =>
        !['inferred', 'synthetic-fallback'].includes(String(building.heightSource || '')) &&
        Number(building.heightM || 0) > 0,
    )
    .map((building) => Number(building.heightM));
  const landmarkThresholdM = sourceHeightValues.length
    ? Math.max(
        70,
        [...sourceHeightValues].sort((a, b) => a - b)[
          Math.floor((sourceHeightValues.length - 1) * 0.95)
        ],
      )
    : 70;
  const namedLandmarkCount = buildings.filter(
    (building) =>
      String(building.name || '').trim() &&
      !['inferred', 'synthetic-fallback'].includes(String(building.heightSource || '')) &&
      Number(building.heightM || 0) >= landmarkThresholdM,
  ).length;
  const terrainReliefM = Math.max(0, Number(mesh?.terrain?.maxElevationM || 0) - Number(mesh?.terrain?.minElevationM || 0));
  const sampledAreaKm2 = Math.PI * Math.pow(radiusM / 1000, 2);
  return {
    buildingCount: buildings.length,
    footprintAreaM2: Math.round(footprintAreaM2),
    estimatedFloorAreaM2: Math.round(estimatedFloorAreaM2),
    averageBuildingHeightM: buildings.length ? Number((heightTotalM / buildings.length).toFixed(1)) : 0,
    roadLengthKm: Number(roadLengthKm.toFixed(2)),
    primaryRoadKm: Number(primaryRoadKm.toFixed(2)),
    powerLineKm: Number(powerLineKm.toFixed(2)),
    highVoltageKm: Number(highVoltageKm.toFixed(2)),
    powerAssetCount: powerAssets.length,
    substations,
    generationAssets,
    waterAreaM2: Math.round(waterAreaM2),
    waterwayLengthKm: Number(waterwayLengthKm.toFixed(2)),
    waterFeatureCount: waterAreas.length + waterways.length + coastlines.length,
    greenAreaM2: Math.round(greenAreaM2),
    greenFeatureCount: greenAreas.length,
    namedLandmarkCount,
    terrainReliefM: Number(terrainReliefM.toFixed(1)),
    sampledAreaKm2: Number(sampledAreaKm2.toFixed(2)),
  };
}

function liveCitySignals(mesh) {
  const environment = mesh?.environment?.current || {};
  const air = mesh?.liveContext?.airQuality?.current || {};
  const seismic = Array.isArray(mesh?.liveContext?.seismic?.events)
    ? mesh.liveContext.seismic.events
    : [];
  const maxSeismicMagnitude = seismic.length
    ? Math.max(...seismic.map((event) => Number(event.magnitude || 0)))
    : 0;
  const nearestSeismicKm = seismic.length
    ? Math.min(...seismic.map((event) => Number(event.distanceKm || Infinity)))
    : null;
  return {
    temperatureC: Number.isFinite(Number(environment.temperatureC))
      ? Number(environment.temperatureC)
      : null,
    apparentTemperatureC: Number.isFinite(Number(environment.apparentTemperatureC))
      ? Number(environment.apparentTemperatureC)
      : null,
    relativeHumidityPercent: Number.isFinite(Number(environment.relativeHumidityPercent))
      ? Number(environment.relativeHumidityPercent)
      : null,
    surfacePressureHpa: Number.isFinite(Number(environment.surfacePressureHpa))
      ? Number(environment.surfacePressureHpa)
      : null,
    isDay: typeof environment.isDay === 'boolean' ? environment.isDay : null,
    sunrise: mesh?.environment?.solar?.sunrise || null,
    sunset: mesh?.environment?.solar?.sunset || null,
    daylightDurationSeconds: Number.isFinite(
      Number(mesh?.environment?.solar?.daylightDurationSeconds),
    )
      ? Number(mesh.environment.solar.daylightDurationSeconds)
      : null,
    cloudCoverPercent: Number.isFinite(Number(environment.cloudCoverPercent))
      ? Number(environment.cloudCoverPercent)
      : null,
    precipitationMm: Number.isFinite(Number(environment.precipitationMm))
      ? Number(environment.precipitationMm)
      : 0,
    windSpeedKph: Number.isFinite(Number(environment.windSpeedKph))
      ? Number(environment.windSpeedKph)
      : 0,
    windGustsKph: Number.isFinite(Number(environment.windGustsKph))
      ? Number(environment.windGustsKph)
      : 0,
    shortwaveRadiationWm2: Number.isFinite(Number(environment.shortwaveRadiationWm2))
      ? Number(environment.shortwaveRadiationWm2)
      : null,
    visibilityM: Number.isFinite(Number(environment.visibilityM))
      ? Number(environment.visibilityM)
      : null,
    usAqi: Number.isFinite(Number(air.usAqi)) ? Number(air.usAqi) : null,
    airCategory: air.category || 'unknown',
    pm25UgM3: Number.isFinite(Number(air.pm25UgM3)) ? Number(air.pm25UgM3) : null,
    pm10UgM3: Number.isFinite(Number(air.pm10UgM3)) ? Number(air.pm10UgM3) : null,
    uvIndex: Number.isFinite(Number(air.uvIndex)) ? Number(air.uvIndex) : null,
    seismicEventCount: seismic.length,
    maxSeismicMagnitude,
    nearestSeismicKm: Number.isFinite(nearestSeismicKm) ? Number(nearestSeismicKm.toFixed(1)) : null,
  };
}

function analyzeCityUseCase(mesh, useCaseId) {
  const useCase = CITY_USE_CASES[useCaseId];
  if (!useCase) {
    const error = new Error(`unsupported city use case: ${useCaseId}`);
    error.status = 400;
    throw error;
  }
  if (!mesh?.city) {
    const error = new Error('city mesh required before running a city operation');
    error.status = 409;
    throw error;
  }
  const metrics = cityMeshMetrics(mesh);
  const liveSignals = liveCitySignals(mesh);
  const densityRatio =
    metrics.sampledAreaKm2 > 0
      ? metrics.footprintAreaM2 / (metrics.sampledAreaKm2 * 1_000_000)
      : 0;
  const builtMass = clampIndex(densityRatio * 420 + metrics.averageBuildingHeightM * 0.55);
  const roadCoverage = clampIndex(metrics.roadLengthKm * 4 + metrics.primaryRoadKm * 7);
  const gridCoverage = clampIndex(
    metrics.powerLineKm * 7 + metrics.powerAssetCount * 5 + metrics.substations * 8,
  );
  const terrainComplexity = clampIndex(metrics.terrainReliefM * 1.4);
  const weatherStress = clampIndex(
    liveSignals.windSpeedKph * 0.6 +
      liveSignals.windGustsKph * 0.8 +
      liveSignals.precipitationMm * 14,
  );
  const airStress = clampIndex(liveSignals.usAqi ?? 0);
  const seismicStress = clampIndex(
    liveSignals.maxSeismicMagnitude * 12 +
      (liveSignals.nearestSeismicKm == null
        ? 0
        : Math.max(0, 800 - liveSignals.nearestSeismicKm) / 12),
  );
  const solarSignal = clampIndex(
    (liveSignals.shortwaveRadiationWm2 || 0) / 10 +
      (100 - (liveSignals.cloudCoverPercent ?? 50)) * 0.25,
  );
  const apparentHeatStress = clampIndex(
    Math.max(0, Number(liveSignals.apparentTemperatureC ?? liveSignals.temperatureC ?? 20) - 20) * 4,
  );
  const humidityStress = clampIndex(liveSignals.relativeHumidityPercent ?? 0);
  const uvStress = clampIndex((liveSignals.uvIndex ?? 0) * 10);
  const visibilityStress =
    liveSignals.visibilityM == null
      ? 0
      : clampIndex(Math.max(0, 20_000 - liveSignals.visibilityM) / 200);
  const sampledAreaM2 = Math.max(1, metrics.sampledAreaKm2 * 1_000_000);
  const waterCoverage = clampIndex((metrics.waterAreaM2 / sampledAreaM2) * 500);
  const waterEdgeContext = clampIndex(metrics.waterwayLengthKm * 7);
  const greenCoverage = clampIndex((metrics.greenAreaM2 / sampledAreaM2) * 650);
  const heatPressure = clampIndex(
    apparentHeatStress * 0.5 + humidityStress * 0.2 + uvStress * 0.12 + builtMass * 0.18,
  );

  let planningIndex = 0;
  let observations = [];
  if (useCaseId === 'grid-resilience') {
    planningIndex = clampIndex(
      gridCoverage * 0.55 +
        roadCoverage * 0.12 +
        (100 - terrainComplexity) * 0.08 +
        weatherStress * 0.17 +
        seismicStress * 0.08,
    );
    observations = [
      `${metrics.powerLineKm.toFixed(1)} km of mapped power lines, ${metrics.powerAssetCount} mapped power assets and ${metrics.substations} substations are visible in the bounded sample.`,
      `Current model context: wind ${liveSignals.windSpeedKph.toFixed(1)} km/h, gusts ${liveSignals.windGustsKph.toFixed(1)} km/h and precipitation ${liveSignals.precipitationMm.toFixed(1)} mm.`,
      `${liveSignals.seismicEventCount} USGS M2.5+ event(s) are within the live seismic radius; this is context for review, not a failure prediction.`,
    ];
  } else if (useCaseId === 'outage-impact') {
    planningIndex = clampIndex(
      builtMass * 0.45 + gridCoverage * 0.35 + weatherStress * 0.15 + seismicStress * 0.05,
    );
    observations = [
      `${metrics.buildingCount} mapped buildings represent approximately ${Math.round(metrics.estimatedFloorAreaM2).toLocaleString()} m² of estimated floor area.`,
      `${metrics.powerAssetCount} mapped power assets overlap the same bounded city sample; current weather attention is ${weatherStress}/100.`,
      'The index is an exposure-planning proxy only; it does not assert customers affected, component failure or outage probability.',
    ];
  } else if (useCaseId === 'emergency-access') {
    planningIndex = clampIndex(
      roadCoverage * 0.62 +
        (100 - terrainComplexity) * 0.18 +
        (100 - weatherStress) * 0.2,
    );
    observations = [
      `${metrics.roadLengthKm.toFixed(1)} km of mapped road centerlines are available, including ${metrics.primaryRoadKm.toFixed(1)} km of major roads.`,
      `Current precipitation is ${liveSignals.precipitationMm.toFixed(1)} mm and gusts are ${liveSignals.windGustsKph.toFixed(1)} km/h; mapped terrain relief is ${metrics.terrainReliefM.toFixed(0)} m.`,
      'Road presence and modeled weather are not live traffic, closure, routing or emergency-response guarantees.',
    ];
  } else if (useCaseId === 'renewable-siting') {
    planningIndex = clampIndex(
      (100 - builtMass) * 0.2 +
        gridCoverage * 0.35 +
        (100 - terrainComplexity) * 0.15 +
        solarSignal * 0.2 +
        clampIndex(liveSignals.windSpeedKph * 3) * 0.1,
    );
    observations = [
      `${metrics.generationAssets} mapped generation assets and ${metrics.powerLineKm.toFixed(1)} km of mapped power lines provide grid-context anchors.`,
      `Current model resource snapshot: ${liveSignals.shortwaveRadiationWm2 == null ? 'solar radiation unavailable' : `${liveSignals.shortwaveRadiationWm2.toFixed(0)} W/m² shortwave radiation`}, ${liveSignals.cloudCoverPercent == null ? 'cloud unavailable' : `${liveSignals.cloudCoverPercent.toFixed(0)}% cloud`} and ${liveSignals.windSpeedKph.toFixed(1)} km/h wind.`,
      'A current weather snapshot does not replace long-term resource assessment, ownership, permitting, interconnection or environmental studies.',
    ];
  } else if (useCaseId === 'load-growth') {
    planningIndex = clampIndex(builtMass * 0.64 + roadCoverage * 0.16 + gridCoverage * 0.2);
    observations = [
      `${metrics.buildingCount} mapped buildings average ${metrics.averageBuildingHeightM.toFixed(1)} m in modeled height.`,
      `Estimated mapped floor area is ${Math.round(metrics.estimatedFloorAreaM2).toLocaleString()} m² inside the bounded sample.`,
      'This is a built-form planning proxy, not a utility load forecast or customer-demand measurement.',
    ];
  } else if (useCaseId === 'weather-readiness') {
    planningIndex = weatherStress;
    observations = [
      `Current weather model: wind ${liveSignals.windSpeedKph.toFixed(1)} km/h, gusts ${liveSignals.windGustsKph.toFixed(1)} km/h and precipitation ${liveSignals.precipitationMm.toFixed(1)} mm.`,
      `Cloud cover is ${liveSignals.cloudCoverPercent == null ? 'unavailable' : `${liveSignals.cloudCoverPercent.toFixed(0)}%`} and visibility is ${liveSignals.visibilityM == null ? 'unavailable' : `${(liveSignals.visibilityM / 1000).toFixed(1)} km`}.`,
      'The animated weather field represents current model conditions at the city coordinate, not street-level instrumentation.',
    ];
  } else if (useCaseId === 'air-quality-exposure') {
    planningIndex = clampIndex(airStress * 0.7 + builtMass * 0.3);
    observations = [
      `Current modeled US AQI is ${liveSignals.usAqi == null ? 'unavailable' : liveSignals.usAqi.toFixed(0)} (${liveSignals.airCategory}).`,
      `PM2.5 is ${liveSignals.pm25UgM3 == null ? 'unavailable' : `${liveSignals.pm25UgM3.toFixed(1)} µg/m³`} and PM10 is ${liveSignals.pm10UgM3 == null ? 'unavailable' : `${liveSignals.pm10UgM3.toFixed(1)} µg/m³`}.`,
      `The atmospheric overlay is paired with ${metrics.buildingCount} mapped buildings and ${metrics.roadLengthKm.toFixed(1)} km of road geometry; it is not a block-level exposure measurement.`,
    ];
  } else if (useCaseId === 'heat-stress') {
    planningIndex = clampIndex(
      apparentHeatStress * 0.45 + humidityStress * 0.2 + uvStress * 0.15 + builtMass * 0.2,
    );
    observations = [
      `Current modeled temperature is ${liveSignals.temperatureC == null ? 'unavailable' : `${liveSignals.temperatureC.toFixed(1)}°C`} with apparent temperature ${liveSignals.apparentTemperatureC == null ? 'unavailable' : `${liveSignals.apparentTemperatureC.toFixed(1)}°C`}.`,
      `Relative humidity is ${liveSignals.relativeHumidityPercent == null ? 'unavailable' : `${liveSignals.relativeHumidityPercent.toFixed(0)}%`} and UV index is ${liveSignals.uvIndex == null ? 'unavailable' : liveSignals.uvIndex.toFixed(1)}.`,
      `Mapped built-form density contributes context from ${metrics.buildingCount} structures; this is an urban heat attention proxy, not WBGT, a clinical heat-risk assessment or a block-level temperature sensor.`,
    ];
  } else if (useCaseId === 'visibility-operations') {
    planningIndex = clampIndex(
      visibilityStress * 0.48 +
        weatherStress * 0.22 +
        airStress * 0.18 +
        clampIndex(metrics.roadLengthKm * 3) * 0.12,
    );
    observations = [
      `Current modeled visibility is ${liveSignals.visibilityM == null ? 'unavailable' : `${(liveSignals.visibilityM / 1000).toFixed(1)} km`}; cloud cover is ${liveSignals.cloudCoverPercent == null ? 'unavailable' : `${liveSignals.cloudCoverPercent.toFixed(0)}%`}.`,
      `Precipitation is ${liveSignals.precipitationMm.toFixed(1)} mm and modeled US AQI is ${liveSignals.usAqi == null ? 'unavailable' : liveSignals.usAqi.toFixed(0)}.`,
      `The scene pairs atmospheric context with ${metrics.roadLengthKm.toFixed(1)} km of mapped roads; it is not a navigation clearance, aviation minimum or live traffic visibility guarantee.`,
    ];
  } else if (useCaseId === 'flood-context') {
    planningIndex = clampIndex(
      waterCoverage * 0.3 +
        waterEdgeContext * 0.18 +
        clampIndex(liveSignals.precipitationMm * 18) * 0.22 +
        builtMass * 0.12 +
        terrainComplexity * 0.08 +
        gridCoverage * 0.1,
    );
    observations = [
      `${metrics.waterFeatureCount} mapped water/coastline feature(s) contribute ${Math.round(metrics.waterAreaM2).toLocaleString()} m² of mapped water area and ${metrics.waterwayLengthKm.toFixed(1)} km of mapped waterway/coastline geometry in the bounded sample.`,
      `Current modeled precipitation is ${liveSignals.precipitationMm.toFixed(1)} mm; mapped terrain relief is ${metrics.terrainReliefM.toFixed(0)} m and ${metrics.roadLengthKm.toFixed(1)} km of road geometry is visible for spatial review.`,
      'This is a mapped-context attention proxy only. It does not model drainage capacity, storm surge, river stage, surface runoff, inundation depth or forecast flooding.',
    ];
  } else if (useCaseId === 'green-infrastructure') {
    planningIndex = clampIndex(
      heatPressure * 0.42 +
        builtMass * 0.28 +
        (100 - greenCoverage) * 0.2 +
        airStress * 0.1,
    );
    observations = [
      `${metrics.greenFeatureCount} mapped green feature(s) contribute approximately ${Math.round(metrics.greenAreaM2).toLocaleString()} m² of green-area geometry in the bounded sample.`,
      `Current heat context includes apparent temperature ${liveSignals.apparentTemperatureC == null ? 'unavailable' : `${liveSignals.apparentTemperatureC.toFixed(1)}°C`}, humidity ${liveSignals.relativeHumidityPercent == null ? 'unavailable' : `${liveSignals.relativeHumidityPercent.toFixed(0)}%`} and US AQI ${liveSignals.usAqi == null ? 'unavailable' : liveSignals.usAqi.toFixed(0)}.`,
      'The result is a screening proxy for where mapped green-space context may deserve closer planning review; it is not canopy coverage, heat-island measurement, public-health exposure or a siting directive.',
    ];
  } else {
    planningIndex = clampIndex(seismicStress * 0.72 + builtMass * 0.18 + terrainComplexity * 0.1);
    observations = [
      `${liveSignals.seismicEventCount} USGS M2.5+ event(s) are inside the configured live radius around ${mesh.city.name}.`,
      `Maximum listed magnitude is ${liveSignals.maxSeismicMagnitude.toFixed(1)}${liveSignals.nearestSeismicKm == null ? '' : ` and the nearest listed event is ${liveSignals.nearestSeismicKm.toFixed(0)} km away`}.`,
      'USGS event pulses provide situational context only; they are not a structural-damage estimate, aftershock forecast or emergency directive.',
    ];
  }

  return {
    schemaVersion: 4,
    useCase,
    city: mesh.city,
    generatedAt: new Date().toISOString(),
    planningIndex: {
      label: useCase.indexLabel,
      value: planningIndex,
      scale: '0-100 bounded planning/context proxy',
    },
    metrics,
    liveSignals,
    observations,
    visualization: {
      animationProfile: useCase.animationProfile,
      recommendedLayers: useCase.recommendedLayers,
      sourceDriven: true,
    },
    dataQuality: {
      geometryProvider: mesh.source?.provider || 'unknown',
      liveGeometry: Boolean(mesh.source?.live),
      terrainProvider: mesh.terrain?.source?.provider || null,
      liveTerrain: Boolean(mesh.terrain?.source?.live),
      weatherProvider: mesh.environment?.source?.provider || null,
      liveWeather: Boolean(mesh.environment?.source?.live),
      airQualityProvider: mesh.liveContext?.airQuality?.source?.provider || null,
      liveAirQuality: Boolean(mesh.liveContext?.airQuality?.source?.live),
      seismicProvider: mesh.liveContext?.seismic?.source?.provider || null,
      liveSeismic: Boolean(mesh.liveContext?.seismic?.source?.live),
      mappedWaterFeatures: metrics.waterFeatureCount,
      mappedGreenFeatures: metrics.greenFeatureCount,
      mappedNamedLandmarks: metrics.namedLandmarkCount,
      limitations:
        'Decision-support indicators combine the currently loaded bounded map sample with current model/feed context and are not operational ground truth.',
    },
    advisoryOnly: true,
  };
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
};

function send(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

function json(response, status, payload) {
  send(response, status, JSON.stringify(payload, null, 2));
}

async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 250_000) throw new Error('payload too large');
  }
  return raw ? JSON.parse(raw) : {};
}

function activity(message, type = 'system') {
  const item = {
    id: createHash('sha256')
      .update(`${Date.now()}:${message}`)
      .digest('hex')
      .slice(0, 16),
    at: new Date().toISOString(),
    type,
    message,
  };
  state.activity.unshift(item);
  state.activity = state.activity.slice(0, 24);
  return item;
}

function snapshot() {
  return {
    ...state,
    regions,
    scenarios,
    views,
  };
}

function agentContext(input = {}) {
  return {
    ...input,
    region: input.region || state.system.region,
    scenario: input.scenario || state.system.scenario,
    view: input.view || state.system.view,
    metrics: input.metrics || state.metrics,
    externalContext: {
      geospatial: state.externalContext.geospatial,
      quantum: state.externalContext.quantum,
    },
    authority: 'advisory-only',
  };
}

function telemetryTick() {
  const now = Date.now();
  state.metrics.generationMw = Math.round(2130 + Math.sin(now / 8200) * 18);
  state.metrics.loadMw = Math.round(2410 + Math.cos(now / 9700) * 23);
  state.metrics.renewablePercent = Number((46.8 + Math.sin(now / 11500) * 1.35).toFixed(1));
  state.metrics.storageMw = Math.round(590 + Math.cos(now / 10400) * 10);
}

function validateChoice(value, allowed, label) {
  if (!allowed.includes(value)) {
    const error = new Error(`unsupported ${label}: ${value}`);
    error.status = 400;
    throw error;
  }
  return value;
}

const server = http.createServer(async (request, response) => {
  const reqContext = createRequestContext({
    requestId: request.headers['x-request-id'] || undefined,
    metadata: { method: request.method, url: request.url },
  });
  const execCtx = {
    executeProviderRequest: providerRegistry.executeProviderRequest,
    requestId: reqContext.requestId,
  };

  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/health') {
      const runtime = agentRuntime.summary();
      return json(response, 200, {
        ok: true,
        product: 'ÆTHERGRID',
        authority: 'advisory-only',
        region: state.system.region,
        view: state.system.view,
        scenario: state.system.scenario,
        agentsOnline: Object.values(state.agents).every((agent) => agent.status === 'ONLINE'),
        aiRuntime: {
          mode: runtime.mode,
          liveProviders: runtime.liveProviders,
        },
        geospatialRuntime: {
          provider: geoRuntime.summary().provider,
          liveProviderConfigured: geoRuntime.summary().liveProviderConfigured,
        },
        environmentRuntime: {
          provider: cityEnvironmentRuntime.summary().provider,
          liveProviderConfigured: cityEnvironmentRuntime.summary().liveProviderConfigured,
        },
        liveContextRuntime: {
          airQualityProvider: cityLiveRuntime.summary().airQualityProvider,
          seismicProvider: cityLiveRuntime.summary().seismicProvider,
          liveAirQualityConfigured: cityLiveRuntime.summary().liveAirQualityConfigured,
          liveSeismicConfigured: cityLiveRuntime.summary().liveSeismicConfigured,
        },
        quantumRuntime: {
          provider: quantumRuntime.summary().provider,
          configured: quantumRuntime.summary().configured,
        },
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/stream') {
      response.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-content-type-options': 'nosniff',
      });
      const sendEvent = () => {
        telemetryTick();
        response.write(
          `event: telemetry\ndata: ${JSON.stringify({ state: snapshot(), at: new Date().toISOString() })}\n\n`,
        );
      };
      sendEvent();
      const interval = setInterval(sendEvent, 2500);
      request.once('close', () => clearInterval(interval));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/state') {
      telemetryTick();
      return json(response, 200, snapshot());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/telemetry') {
      telemetryTick();
      return json(response, 200, {
        metrics: state.metrics,
        system: state.system,
        at: new Date().toISOString(),
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/evidence') {
      return json(response, 200, { evidence: state.evidence, activity: state.activity });
    }
    if (
      request.method === 'GET' &&
      url.pathname.startsWith('/api/aethergrid/evidence/') &&
      url.pathname !== '/api/aethergrid/evidence/'
    ) {
      const id = decodeURIComponent(url.pathname.slice('/api/aethergrid/evidence/'.length));
      const record = state.evidence.find((item) => item.id === id || item.receipt === id);
      if (!record) return json(response, 404, { error: 'evidence_not_found' });
      return json(response, 200, { evidence: record, advisoryOnly: true });
    }

                                if (request.method === 'GET' && url.pathname === '/api/aethergrid/config/public') {
      return json(
        response,
        200,
        providerRegistry.redactor.redactValue(createPublicConfig(providerRegistry.config)),
      );
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/weather/current') {
      const latParam = url.searchParams.get('lat');
      const lonParam = url.searchParams.get('lon');

      if (!latParam || !lonParam) {
        return json(response, 200, {
          data: {
            status: 'missing_coordinates',
            message: 'Explicit lat and lon query parameters are required.',
            live: false,
          },
          receipt: {
            provider: 'open-meteo-weather',
            capability: 'weather',
            dataset: 'open-meteo-weather',
            requestId: reqContext.requestId,
            live: false,
            fallback: true,
            attribution: 'Open-Meteo Weather API (Missing Coordinates)',
          },
        });
      }

      const lat = Number(latParam);
      const lon = Number(lonParam);

      if (providerRegistry.config.weather.provider === 'tomorrow-io') {
        const result = await tomorrowWeatherProvider.request(
          { lat, lon, mode: 'realtime' },
          execCtx,
        );
        return json(response, 200, providerRegistry.redactor.redactValue(result));
      }

      const fetcher = () => cityEnvironmentRuntime.current({ lat, lon });
      const result = await providerRegistry.executeProviderRequest(
        'open-meteo-weather',
        { lat, lon, requestId: reqContext.requestId, capability: 'weather', dataset: 'open-meteo-weather', ttlMs: 120000, attribution: 'Open-Meteo Weather API' },
        fetcher,
      );
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/weather/forecast') {
      const latParam = url.searchParams.get('lat');
      const lonParam = url.searchParams.get('lon');

      if (!latParam || !lonParam) {
        return json(response, 200, {
          data: {
            status: 'missing_coordinates',
            message: 'Explicit lat and lon query parameters are required.',
            live: false,
          },
          receipt: {
            provider: 'open-meteo-weather',
            capability: 'weather',
            dataset: 'open-meteo-forecast',
            requestId: reqContext.requestId,
            live: false,
            fallback: true,
            attribution: 'Open-Meteo Weather API (Missing Coordinates)',
          },
        });
      }

      const lat = Number(latParam);
      const lon = Number(lonParam);

      if (providerRegistry.config.weather.provider === 'tomorrow-io') {
        const result = await tomorrowWeatherProvider.request(
          { lat, lon, mode: 'forecast' },
          execCtx,
        );
        return json(response, 200, providerRegistry.redactor.redactValue(result));
      }

      const fetcher = () => cityEnvironmentRuntime.forecast({ lat, lon });
      const result = await providerRegistry.executeProviderRequest(
        'open-meteo-weather',
        { lat, lon, requestId: reqContext.requestId, capability: 'weather', dataset: 'open-meteo-forecast', ttlMs: 300000, attribution: 'Open-Meteo Weather API' },
        fetcher,
      );
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/hazards/alerts') {
      const lat = url.searchParams.has('lat') ? Number(url.searchParams.get('lat')) : undefined;
      const lon = url.searchParams.has('lon') ? Number(url.searchParams.get('lon')) : undefined;
      const result = await nwsAlertsProvider.request(
        { lat, lon },
        execCtx,
      );
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/hydrology/gauges') {
      const gaugeId = url.searchParams.get('gaugeId') || undefined;
      const result = await noaaNwpsProvider.request(
        { gaugeId },
        execCtx,
      );
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/energy/context') {
      const region = url.searchParams.get('region') || undefined;
      const result = await eiaProvider.request(
        { region },
        execCtx,
      );
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/transit/vehicles') {
      const cityId = url.searchParams.get('cityId') || undefined;
      const result = await transitRegistry.adapter.request(
        { cityId },
        execCtx,
      );
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/dwave/solvers') {
      const result = await dwaveProvider.request({ action: 'discover' }, execCtx);
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/dwave/jobs') {
      const problemId = url.searchParams.get('id') || undefined;
      if (!problemId) {
        return json(response, 400, { error: 'invalid_request', message: 'Explicit id query parameter is required for D-Wave job status' });
      }
      const result = await dwaveProvider.request({ action: 'status', problemId }, execCtx);
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/quantum/dwave/jobs') {
      const payload = await body(request);
      if (!payload || !payload.confirmSubmission) {
        return json(response, 400, { error: 'confirmation_required', message: 'Explicit operator confirmation (confirmSubmission: true) is required to submit D-Wave hardware jobs.' });
      }
      const result = await dwaveProvider.request({ action: 'submit', problemPayload: payload.problemPayload }, execCtx);
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

if (request.method === 'GET' && url.pathname === '/api/aethergrid/runtime/providers') {
      return json(
        response,
        200,
        providerRegistry.redactor.redactValue(providerRegistry.getSafePublicRuntimeMetadata()),
      );
    }

if (request.method === 'GET' && url.pathname === '/api/aethergrid/runtime') {
      const ai = agentRuntime.summary();
      return json(response, 200, {
        ...ai,
        ai,
        geospatial: geoRuntime.summary(),
        environment: cityEnvironmentRuntime.summary(),
        liveContext: cityLiveRuntime.summary(),
        terrain: terrainRuntime.summary(),
        quantum: quantumRuntime.summary(),
        profile: profileStore.safeSummary(),
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/profile') {
      return json(response, 200, { profile: await profileStore.load() });
    }

    if (request.method === 'PUT' && url.pathname === '/api/aethergrid/profile') {
      const input = await body(request);
      const profile = await profileStore.save(input.profile || input);
      activity(`Operator profile updated for ${profile.displayName}.`, 'profile');
      return json(response, 200, { profile, activity: state.activity });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/global-live') {
      const live = await cityLiveRuntime.globalSnapshot(geoRuntime.cities, {
        force: url.searchParams.get('force') === '1',
      });
      return json(response, 200, live);
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/geospatial/runtime') {
      return json(response, 200, geoRuntime.summary());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/geospatial/cities') {
      return json(response, 200, {
        cities: geoRuntime.cities,
        runtime: geoRuntime.summary(),
      });
    }

    if (
      request.method === 'GET' &&
      url.pathname.startsWith('/api/aethergrid/geospatial/city/')
    ) {
      const cityId = decodeURIComponent(
        url.pathname.slice('/api/aethergrid/geospatial/city/'.length),
      );
      const baseMesh = await geoRuntime.cityMesh(cityId, {
        force: url.searchParams.get('force') === '1',
      });
      const [terrain, environment, liveContext] = await Promise.all([
        terrainRuntime.sample({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
          radiusM: baseMesh.city.radiusM,
          gridSize: 7,
        }),
        cityEnvironmentRuntime.current({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
        }),
        cityLiveRuntime.citySnapshot({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
          radiusKm: 1200,
          force: url.searchParams.get('force') === '1',
        }),
      ]);
      const mesh = { ...baseMesh, terrain, environment, liveContext };
      activeCityMesh = mesh;
      state.externalContext.geospatial = {
        cityId: mesh.city.id,
        name: mesh.city.name,
        lat: mesh.city.lat,
        lon: mesh.city.lon,
        radiusM: mesh.city.radiusM,
        source: mesh.source.provider,
        live: Boolean(mesh.source.live),
        buildings: mesh.buildings.length,
        roads: (mesh.roads || []).length,
        powerLines: (mesh.powerLines || []).length,
        powerAssets: (mesh.powerAssets || []).length,
        skyline: mesh.skylineProfile || null,
        terrain: {
          provider: mesh.terrain?.source?.provider || null,
          live: Boolean(mesh.terrain?.source?.live),
          minElevationM: mesh.terrain?.minElevationM ?? null,
          maxElevationM: mesh.terrain?.maxElevationM ?? null,
        },
        environment: {
          provider: mesh.environment?.source?.provider || null,
          live: Boolean(mesh.environment?.source?.live),
          observedAt: mesh.environment?.source?.modelTime || mesh.environment?.current?.time || null,
          temperatureC: mesh.environment?.current?.temperatureC ?? null,
          cloudCoverPercent: mesh.environment?.current?.cloudCoverPercent ?? null,
          precipitationMm: mesh.environment?.current?.precipitationMm ?? null,
          isDay: mesh.environment?.current?.isDay ?? null,
          windSpeedKph: mesh.environment?.current?.windSpeedKph ?? null,
          windGustsKph: mesh.environment?.current?.windGustsKph ?? null,
          shortwaveRadiationWm2: mesh.environment?.current?.shortwaveRadiationWm2 ?? null,
          visibilityM: mesh.environment?.current?.visibilityM ?? null,
          relativeHumidityPercent: mesh.environment?.current?.relativeHumidityPercent ?? null,
          surfacePressureHpa: mesh.environment?.current?.surfacePressureHpa ?? null,
          sunrise: mesh.environment?.solar?.sunrise ?? null,
          sunset: mesh.environment?.solar?.sunset ?? null,
        },
        liveContext: {
          airQualityProvider: mesh.liveContext?.airQuality?.source?.provider || null,
          liveAirQuality: Boolean(mesh.liveContext?.airQuality?.source?.live),
          usAqi: mesh.liveContext?.airQuality?.current?.usAqi ?? null,
          pm25UgM3: mesh.liveContext?.airQuality?.current?.pm25UgM3 ?? null,
          seismicProvider: mesh.liveContext?.seismic?.source?.provider || null,
          liveSeismic: Boolean(mesh.liveContext?.seismic?.source?.live),
          seismicEventCount: mesh.liveContext?.seismic?.eventCount ?? 0,
          maxSeismicMagnitude: mesh.liveContext?.seismic?.maxMagnitude ?? null,
        },
      };
      activity(
        `Geospatial city mesh loaded: ${mesh.city.name} via ${mesh.source.provider} (${mesh.buildings.length} buildings, ${(mesh.powerLines || []).length} power lines, ${(mesh.powerAssets || []).length} power assets).`,
        'geospatial',
      );
      return json(response, 200, {
        ...mesh,
        externalContext: state.externalContext,
        activity: state.activity,
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/geospatial/point') {
      const baseMesh = await geoRuntime.pointMesh(
        {
          lat: url.searchParams.get('lat'),
          lon: url.searchParams.get('lon'),
          name: url.searchParams.get('name') || 'Coordinate Explorer',
          radiusM: url.searchParams.get('radiusM') || 900,
        },
        {
          force: url.searchParams.get('force') === '1',
        },
      );
      const [terrain, environment, liveContext] = await Promise.all([
        terrainRuntime.sample({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
          radiusM: baseMesh.city.radiusM,
          gridSize: 7,
        }),
        cityEnvironmentRuntime.current({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
        }),
        cityLiveRuntime.citySnapshot({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
          radiusKm: 1200,
          force: url.searchParams.get('force') === '1',
        }),
      ]);
      const mesh = { ...baseMesh, terrain, environment, liveContext };
      activeCityMesh = mesh;
      state.externalContext.geospatial = {
        cityId: mesh.city.id,
        name: mesh.city.name,
        lat: mesh.city.lat,
        lon: mesh.city.lon,
        radiusM: mesh.city.radiusM,
        source: mesh.source.provider,
        live: Boolean(mesh.source.live),
        buildings: mesh.buildings.length,
        roads: (mesh.roads || []).length,
        powerLines: (mesh.powerLines || []).length,
        powerAssets: (mesh.powerAssets || []).length,
        skyline: mesh.skylineProfile || null,
        terrain: {
          provider: mesh.terrain?.source?.provider || null,
          live: Boolean(mesh.terrain?.source?.live),
          minElevationM: mesh.terrain?.minElevationM ?? null,
          maxElevationM: mesh.terrain?.maxElevationM ?? null,
        },
        environment: {
          provider: mesh.environment?.source?.provider || null,
          live: Boolean(mesh.environment?.source?.live),
          observedAt: mesh.environment?.source?.modelTime || mesh.environment?.current?.time || null,
          temperatureC: mesh.environment?.current?.temperatureC ?? null,
          cloudCoverPercent: mesh.environment?.current?.cloudCoverPercent ?? null,
          precipitationMm: mesh.environment?.current?.precipitationMm ?? null,
          isDay: mesh.environment?.current?.isDay ?? null,
          windSpeedKph: mesh.environment?.current?.windSpeedKph ?? null,
          windGustsKph: mesh.environment?.current?.windGustsKph ?? null,
          shortwaveRadiationWm2: mesh.environment?.current?.shortwaveRadiationWm2 ?? null,
          visibilityM: mesh.environment?.current?.visibilityM ?? null,
          relativeHumidityPercent: mesh.environment?.current?.relativeHumidityPercent ?? null,
          surfacePressureHpa: mesh.environment?.current?.surfacePressureHpa ?? null,
          sunrise: mesh.environment?.solar?.sunrise ?? null,
          sunset: mesh.environment?.solar?.sunset ?? null,
        },
        liveContext: {
          airQualityProvider: mesh.liveContext?.airQuality?.source?.provider || null,
          liveAirQuality: Boolean(mesh.liveContext?.airQuality?.source?.live),
          usAqi: mesh.liveContext?.airQuality?.current?.usAqi ?? null,
          pm25UgM3: mesh.liveContext?.airQuality?.current?.pm25UgM3 ?? null,
          seismicProvider: mesh.liveContext?.seismic?.source?.provider || null,
          liveSeismic: Boolean(mesh.liveContext?.seismic?.source?.live),
          seismicEventCount: mesh.liveContext?.seismic?.eventCount ?? 0,
          maxSeismicMagnitude: mesh.liveContext?.seismic?.maxMagnitude ?? null,
        },
      };
      activity(
        `Coordinate mesh loaded: ${mesh.city.lat.toFixed(5)}, ${mesh.city.lon.toFixed(5)} via ${mesh.source.provider}.`,
        'geospatial',
      );
      return json(response, 200, {
        ...mesh,
        externalContext: state.externalContext,
        activity: state.activity,
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/city-operations/use-cases') {
      return json(response, 200, {
        useCases: Object.values(CITY_USE_CASES),
        activeCity: activeCityMesh?.city || null,
        advisoryOnly: true,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/city-operations/analyze') {
      const input = await body(request);
      const analysis = analyzeCityUseCase(activeCityMesh, String(input.useCaseId || 'grid-resilience'));
      const receipt = createHash('sha256')
        .update(JSON.stringify({ analysis, at: analysis.generatedAt }))
        .digest('hex');
      analysis.receipt = receipt;
      state.externalContext.geospatial = {
        ...(state.externalContext.geospatial || {}),
        useCase: {
          id: analysis.useCase.id,
          label: analysis.useCase.label,
          planningIndex: analysis.planningIndex,
          metrics: analysis.metrics,
          observations: analysis.observations,
          receipt,
        },
      };
      const record = {
        id: receipt.slice(0, 16),
        title: `${analysis.city.name}: ${analysis.useCase.label}`,
        type: 'CITY_OPERATION',
        age: 'just now',
        status: 'VERIFIED',
        receipt,
        details: {
          city: analysis.city.name,
          useCase: analysis.useCase.id,
          planningIndex: analysis.planningIndex,
          source: analysis.dataQuality.geometryProvider,
          advisoryOnly: true,
        },
      };
      state.evidence.unshift(record);
      state.evidence = state.evidence.slice(0, 24);
      activity(`City operation completed: ${analysis.useCase.label} for ${analysis.city.name}.`, 'city-operation');
      return json(response, 200, { analysis, evidence: record, externalContext: state.externalContext, activity: state.activity });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/city-live') {
      const live = await cityLiveRuntime.citySnapshot({
        lat: url.searchParams.get('lat'),
        lon: url.searchParams.get('lon'),
        radiusKm: url.searchParams.get('radiusKm') || 1200,
        force: url.searchParams.get('force') === '1',
      });
      return json(response, 200, live);
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/city-live/runtime') {
      return json(response, 200, cityLiveRuntime.summary());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/environment') {
      const environment = await cityEnvironmentRuntime.current({
        lat: url.searchParams.get('lat'),
        lon: url.searchParams.get('lon'),
      });
      return json(response, 200, environment);
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/environment/runtime') {
      return json(response, 200, cityEnvironmentRuntime.summary());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/terrain') {
      const terrain = await terrainRuntime.sample({
        lat: url.searchParams.get('lat'),
        lon: url.searchParams.get('lon'),
        radiusM: url.searchParams.get('radiusM') || 900,
        gridSize: url.searchParams.get('gridSize') || 7,
      });
      state.externalContext.geospatial = {
        ...(state.externalContext.geospatial || {}),
        terrain: {
          provider: terrain.source.provider,
          live: Boolean(terrain.source.live),
          minElevationM: terrain.minElevationM,
          maxElevationM: terrain.maxElevationM,
          gridSize: terrain.gridSize,
        },
      };
      activity(
        `Terrain sample loaded via ${terrain.source.provider} (${terrain.gridSize}×${terrain.gridSize}, ${terrain.minElevationM}–${terrain.maxElevationM} m).`,
        'terrain',
      );
      return json(response, 200, {
        ...terrain,
        externalContext: state.externalContext,
        activity: state.activity,
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/terrain/runtime') {
      return json(response, 200, terrainRuntime.summary());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/runtime') {
      return json(response, 200, quantumRuntime.summary());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/backends') {
      return json(response, 200, await quantumRuntime.listBackends());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/jobs') {
      return json(response, 200, await quantumRuntime.listJobs({
        limit: url.searchParams.get('limit') || 20,
      }));
    }

    if (
      request.method === 'GET' &&
      url.pathname.startsWith('/api/aethergrid/quantum/jobs/')
    ) {
      const suffix = url.pathname.slice('/api/aethergrid/quantum/jobs/'.length);
      const [encodedJobId, action] = suffix.split('/');
      const jobId = decodeURIComponent(encodedJobId || '');
      if (!jobId) return json(response, 400, { error: 'quantum_job_id_required' });
      if (action === 'results') {
        return json(response, 200, await quantumRuntime.jobResults(jobId));
      }
      if (action === 'metrics') {
        return json(response, 200, await quantumRuntime.jobMetrics(jobId));
      }
      if (action) return json(response, 404, { error: 'quantum_job_route_not_found' });
      return json(response, 200, await quantumRuntime.job(jobId));
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/quantum/jobs') {
      const input = await body(request);
      const primitive = String(input.primitive || 'sampler').toLowerCase();
      if (!['sampler', 'estimator'].includes(primitive)) {
        return json(response, 400, { error: 'unsupported_quantum_primitive' });
      }
      const result =
        primitive === 'estimator'
          ? await quantumRuntime.submitEstimator({
              circuit: input.circuit,
              backend: input.backend,
              observable: input.observable,
            })
          : await quantumRuntime.submitSampler({
              circuit: input.circuit,
              backend: input.backend,
              shots: input.shots,
            });
      const record = {
        id: result.receipt.slice(0, 16),
        title: `Quantum ${String(result.programId || primitive).toUpperCase()}: ${result.backend}`,
        type: 'QUANTUM_JOB',
        age: 'just now',
        status: result.status === 'COMPLETED' ? 'VERIFIED' : 'PENDING',
        receipt: result.receipt,
        details: {
          provider: result.provider,
          backend: result.backend,
          programId: result.programId,
          observable: result.observable || null,
          expectationValue:
            Number.isFinite(Number(result.expectationValue))
              ? Number(result.expectationValue)
              : null,
          approximation: result.approximation || null,
          status: result.status,
          hardwareSubmitted: Boolean(result.hardwareSubmitted),
          hardwareExecuted: Boolean(result.hardwareExecuted),
          jobId: result.id,
          advisoryOnly: true,
        },
      };
      state.evidence.unshift(record);
      state.evidence = state.evidence.slice(0, 24);
      state.externalContext.quantum = {
        jobId: result.id,
        provider: result.provider,
        backend: result.backend,
        programId: result.programId,
        observable: result.observable || null,
        expectationValue:
          Number.isFinite(Number(result.expectationValue))
            ? Number(result.expectationValue)
            : null,
        status: result.status,
        hardwareSubmitted: Boolean(result.hardwareSubmitted),
        hardwareExecuted: Boolean(result.hardwareExecuted),
        receipt: result.receipt,
      };
      activity(
        `Quantum ${result.programId || primitive} job ${result.id} submitted through ${result.provider}/${result.backend}; status ${result.status}.`,
        'quantum',
      );
      return json(response, 200, {
        job: result,
        evidence: record,
        activity: state.activity,
        advisoryOnly: true,
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/spatial') {
      const requestedHour = Number(url.searchParams.get('hour') ?? 12);
      const hour = Math.max(0, Math.min(24, Number.isFinite(requestedHour) ? requestedHour : 12));
      return json(response, 200, {
        ...spatialGraph,
        timeHour: hour,
        region: state.system.region,
        scenario: state.system.scenario,
        advisoryOnly: true,
      });
    }


    if (request.method === 'POST' && url.pathname === '/api/aethergrid/view') {
      const input = await body(request);
      const view = validateChoice(String(input.view || ''), views, 'view');
      state.system.view = view;
      activity(`Operator review mode changed to ${view}.`, 'view');
      return json(response, 200, { state: snapshot() });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/region') {
      const input = await body(request);
      const region = validateChoice(String(input.region || ''), regions, 'region');
      state.system.region = region;
      activity(`Operator region changed to ${region}.`, 'region');
      return json(response, 200, { state: snapshot() });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/scenario') {
      const input = await body(request);
      const scenario = validateChoice(String(input.scenario || ''), scenarios, 'scenario');
      state.system.scenario = scenario;
      state.system.view = 'scenario';
      if (scenario === 'custom') {
        const parameters = input.parameters || {};
        const clampNumber = (value, fallback, min, max) => {
          const parsed = Number(value);
          return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
        };
        state.system.scenarioParameters = {
          loadMultiplierPercent: clampNumber(
            parameters.loadMultiplierPercent,
            state.system.scenarioParameters.loadMultiplierPercent,
            70,
            150,
          ),
          renewableAvailabilityPercent: clampNumber(
            parameters.renewableAvailabilityPercent,
            state.system.scenarioParameters.renewableAvailabilityPercent,
            40,
            160,
          ),
          storageReservePercent: clampNumber(
            parameters.storageReservePercent,
            state.system.scenarioParameters.storageReservePercent,
            5,
            45,
          ),
          weatherRiskPercent: clampNumber(
            parameters.weatherRiskPercent,
            state.system.scenarioParameters.weatherRiskPercent,
            0,
            100,
          ),
        };
      }
      activity(
        `Scenario loaded: ${scenario}${scenario === 'custom' ? ` ${JSON.stringify(state.system.scenarioParameters)}` : ''}.`,
        'scenario',
      );
      const scenarioRecord = {
        id: `scenario-${Date.now()}`,
        title: `Scenario: ${scenario}`,
        type: 'SCENARIO',
        age: 'just now',
        status: 'VERIFIED',
        details: {
          region: state.system.region,
          scenario,
          parameters: scenario === 'custom' ? { ...state.system.scenarioParameters } : null,
          view: state.system.view,
          advisoryOnly: true,
        },
      };
      scenarioRecord.receipt = createHash('sha256').update(JSON.stringify(scenarioRecord)).digest('hex');
      state.evidence.unshift(scenarioRecord);
      state.evidence = state.evidence.slice(0, 24);
      return json(response, 200, { state: snapshot(), evidence: scenarioRecord });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/reset') {
      state.system.region = 'New York Metro';
      state.system.view = 'live';
      state.system.scenario = 'peak-demand';
      state.system.scenarioParameters = {
        loadMultiplierPercent: 110,
        renewableAvailabilityPercent: 100,
        storageReservePercent: 18,
        weatherRiskPercent: 20,
      };
      state.optimization.currentCost = 12480;
      state.optimization.candidateCost = 10230;
      state.optimization.classicalCandidateCost = 11790;
      state.optimization.emissionsReduction = 24.3;
      state.optimization.renewableUtilizationGain = 16.7;
      state.optimization.reliabilityScore = 90.0;
      activity('Operator review state reset to the New York Metro live baseline.', 'reset');
      return json(response, 200, { state: snapshot() });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/optimize') {
      const input = await body(request);
      if (input.region && regions.includes(String(input.region))) state.system.region = String(input.region);
      if (input.scenario && scenarios.includes(String(input.scenario))) {
        state.system.scenario = String(input.scenario);
      }

      const objective = String(input.objective || 'balanced');
      const rawCostWeight = Number(input.weights?.cost ?? 50);
      const rawEmissionsWeight = Number(input.weights?.emissions ?? 50);
      const costWeight = Math.max(0, Math.min(100, Number.isFinite(rawCostWeight) ? rawCostWeight : 50));
      const emissionsWeight = Math.max(
        0,
        Math.min(100, Number.isFinite(rawEmissionsWeight) ? rawEmissionsWeight : 50),
      );
      const minimumReservePercent = Math.max(
        5,
        Math.min(40, Number(input.constraints?.minimumReservePercent ?? 18)),
      );
      const classicalBaselineRequired =
        input.constraints?.classicalBaselineRequired !== false;

      const custom = state.system.scenarioParameters;
      const customFactor =
        (custom.loadMultiplierPercent / 100) *
        (1 + custom.weatherRiskPercent / 1000) *
        (1 + Math.max(0, custom.storageReservePercent - 18) / 500) *
        (1 - Math.max(0, custom.renewableAvailabilityPercent - 100) / 1000);
      const scenarioFactor = {
        'peak-demand': 1.0,
        'renewable-surge': 0.88,
        'storage-stress': 1.12,
        'weather-event': 1.18,
        custom: customFactor,
      }[state.system.scenario] ?? 1.0;

      const objectiveBias = {
        balanced: { cost: 0.5, emissions: 0.5, reliability: 0.5, renewable: 0.5 },
        cost: { cost: 0.9, emissions: 0.2, reliability: 0.45, renewable: 0.35 },
        emissions: { cost: 0.25, emissions: 0.95, reliability: 0.45, renewable: 0.7 },
        reliability: { cost: 0.25, emissions: 0.3, reliability: 0.95, renewable: 0.4 },
        renewables: { cost: 0.3, emissions: 0.75, reliability: 0.5, renewable: 0.95 },
      }[objective] ?? { cost: 0.5, emissions: 0.5, reliability: 0.5, renewable: 0.5 };

      const normalizedCost = costWeight / 100;
      const normalizedEmissions = emissionsWeight / 100;
      const reservePenalty = Math.max(0, minimumReservePercent - 18) * 0.0028;
      const currentCost = 12480 * scenarioFactor;
      const classicalImprovement =
        0.045 +
        normalizedCost * 0.028 +
        objectiveBias.cost * 0.022 -
        reservePenalty * 0.35;
      const experimentalImprovement =
        classicalImprovement +
        0.018 +
        objectiveBias.renewable * 0.014 +
        normalizedEmissions * 0.008 -
        reservePenalty * 0.2;

      const classicalCandidateCost = Math.round(
        currentCost * (1 - Math.max(0.02, Math.min(0.14, classicalImprovement))),
      );
      const candidateCost = Math.round(
        currentCost * (1 - Math.max(0.03, Math.min(0.19, experimentalImprovement))),
      );
      const emissionsReduction = Number(
        (
          10 +
          normalizedEmissions * 11 +
          objectiveBias.emissions * 7 +
          (state.system.scenario === 'renewable-surge' ? 4 : 0) +
          (state.system.scenario === 'custom'
            ? Math.max(0, state.system.scenarioParameters.renewableAvailabilityPercent - 100) * 0.08
            : 0)
        ).toFixed(1),
      );
      const renewableUtilizationGain = Number(
        (
          6 +
          objectiveBias.renewable * 10 +
          normalizedEmissions * 4 +
          (state.system.scenario === 'renewable-surge' ? 5 : 0) +
          (state.system.scenario === 'custom'
            ? Math.max(0, state.system.scenarioParameters.renewableAvailabilityPercent - 100) * 0.12
            : 0)
        ).toFixed(1),
      );
      const reliabilityScore = Number(
        Math.max(
          0,
          Math.min(
            100,
            82 +
              objectiveBias.reliability * 9 +
              minimumReservePercent * 0.22 -
              (state.system.scenario === 'weather-event' ? 7 : 0),
          ),
        ).toFixed(1),
      );

      state.optimization.runCount += 1;
      state.optimization.currentCost = Math.round(currentCost);
      state.optimization.classicalCandidateCost = classicalCandidateCost;
      state.optimization.candidateCost = candidateCost;
      state.optimization.emissionsReduction = emissionsReduction;
      state.optimization.renewableUtilizationGain = renewableUtilizationGain;
      state.optimization.reliabilityScore = reliabilityScore;

      const completedAt = new Date().toISOString();
      const run = {
        id: `optimization-${state.optimization.runCount}`,
        completedAt,
        objective,
        weights: { cost: costWeight, emissions: emissionsWeight },
        constraints: { minimumReservePercent, classicalBaselineRequired },
        scenario: state.system.scenario,
        region: state.system.region,
        baseline: {
          currentCost: Math.round(currentCost),
          classicalCandidateCost,
        },
        candidate: {
          cost: candidateCost,
          emissionsReduction,
          renewableUtilizationGain,
          reliabilityScore,
        },
      };
      const receipt = createHash('sha256')
        .update(JSON.stringify(run))
        .digest('hex');
      run.receipt = receipt;
      state.optimization.history.unshift(run);
      state.optimization.history = state.optimization.history.slice(0, 20);
      state.evidence.unshift({
        id: receipt.slice(0, 16),
        title: `Optimization: ${objective} / ${state.system.scenario}`,
        type: 'OPTIMIZATION',
        age: 'just now',
        status: 'VERIFIED',
        receipt,
      });
      state.evidence = state.evidence.slice(0, 24);

      activity(
        `Bounded optimization completed for ${state.system.region} / ${state.system.scenario}; classical baseline ${classicalCandidateCost} and experimental candidate ${candidateCost} recorded.`,
        'optimization',
      );
      return json(response, 200, {
        status: 'completed',
        optimization: state.optimization,
        comparison: {
          classical: {
            candidateCost: classicalCandidateCost,
            method: 'deterministic-classical-baseline',
          },
          experimental: {
            candidateCost,
            emissionsReduction,
            renewableUtilizationGain,
            reliabilityScore,
            method: 'bounded-experimental-search',
          },
        },
        receipt,
        advisoryOnly: true,
        classicalBaselineRequired,
        activity: state.activity,
      });
    }

    if (
      request.method === 'POST' &&
      url.pathname.startsWith('/api/aethergrid/agents/')
    ) {
      const input = await body(request);
      const encodedId = url.pathname.slice('/api/aethergrid/agents/'.length);
      const agentId = decodeURIComponent(encodedId);
      const result = await agentRuntime.runAgent(agentId, {
        message: input.message,
        context: agentContext(input.context),
        history: Array.isArray(input.history) ? input.history : [],
      });
      activity(
        `${agentId} completed an advisory model request using ${result.runtime.provider}/${result.runtime.model || 'fallback'}.`,
        'ai',
      );
      const agentRecord = {
        id: result.receipt.slice(0, 16),
        title: `${agentId} Advisory Analysis`,
        type: 'AI_AGENT',
        age: 'just now',
        status: 'VERIFIED',
        receipt: result.receipt,
        details: {
          agent: agentId,
          provider: result.runtime.provider,
          model: result.runtime.model,
          fallbackUsed: result.runtime.fallbackUsed,
          latencyMs: result.runtime.latencyMs,
          region: state.system.region,
          scenario: state.system.scenario,
          advisoryOnly: true,
        },
      };
      state.evidence.unshift(agentRecord);
      state.evidence = state.evidence.slice(0, 24);
      return json(response, 200, {
        ...result,
        evidence: agentRecord,
        advisoryOnly: true,
        activity: state.activity,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/team') {
      const input = await body(request);
      const result = await agentRuntime.runTeam({
        message: input.message,
        context: agentContext(input.context),
        history: Array.isArray(input.history) ? input.history : [],
      });
      activity(
        `ÆTHERGRID team completed a coordinated advisory request with ${result.contributions.length} agent contributions.`,
        'ai-team',
      );
      const teamRecord = {
        id: result.receipt.slice(0, 16),
        title: 'ÆTHERGRID Multi-Agent Synthesis',
        type: 'AI_TEAM',
        age: 'just now',
        status: 'VERIFIED',
        receipt: result.receipt,
        details: {
          provider: result.runtime.provider,
          model: result.runtime.model,
          fallbackUsed: result.runtime.fallbackUsed,
          contributionReceipts: result.contributions.map((item) => ({
            agent: item.agent,
            receipt: item.receipt,
            provider: item.runtime.provider,
            model: item.runtime.model,
          })),
          region: state.system.region,
          scenario: state.system.scenario,
          advisoryOnly: true,
        },
      };
      state.evidence.unshift(teamRecord);
      state.evidence = state.evidence.slice(0, 24);
      return json(response, 200, {
        ...result,
        evidence: teamRecord,
        advisoryOnly: true,
        activity: state.activity,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/chat') {
      const input = await body(request);
      const requestedAgent = String(input.agent || 'TEAM');
      const result =
        requestedAgent === 'TEAM'
          ? await agentRuntime.runTeam({
              message: input.message,
              context: agentContext(input.context),
            })
          : await agentRuntime.runAgent(requestedAgent, {
              message: input.message,
              context: agentContext(input.context),
            });
      activity(`AI collaboration completed for ${requestedAgent}.`, 'ai');
      return json(response, 200, {
        reply: result.reply || result.synthesis,
        result,
        advisoryOnly: true,
        activity: state.activity,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/export') {
      const input = await body(request);
      const receipt = createHash('sha256')
        .update(JSON.stringify({ input, state: snapshot(), ts: new Date().toISOString() }))
        .digest('hex');
      activity(`Evidence export prepared: ${input.kind || 'package'}.`, 'export');
      return json(response, 200, {
        receipt,
        format: 'json',
        advisoryOnly: true,
        generatedAt: new Date().toISOString(),
        state: snapshot(),
      });
    }

    if (!['GET', 'HEAD'].includes(request.method || '')) {
      return json(response, 405, { error: 'method_not_allowed' });
    }

    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const safe = normalize(requested)
      .replace(/^(\.\.[/\\])+/, '')
      .replace(/^[/\\]+/, '');
    const filePath = join(root, safe);

    if (
      !filePath.startsWith(root) ||
      safe === '.aethergrid-data' ||
      safe.startsWith('.aethergrid-data/') ||
      safe.startsWith('.aethergrid-data\\')
    ) {
      return json(response, 403, { error: 'forbidden' });
    }

    const info = await stat(filePath);
    if (!info.isFile()) return json(response, 404, { error: 'not_found' });

    const data = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    if (request.method === 'HEAD') return response.end();
    response.end(data);
  } catch (error) {
    if (error?.code === 'ENOENT') return json(response, 404, { error: 'not_found' });
    const status = Number(error?.status || 500);
    json(response, status, {
      error: status === 400 ? 'invalid_request' : 'server_error',
      message: error.message,
    });
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(port, '127.0.0.1', () => {
    activity(`ÆTHERGRID backend started on port ${port}.`, 'system');
    process.stdout.write(`ÆTHERGRID app listening on http://127.0.0.1:${port}\n`);
  });
}

export { providerRegistry, CITY_USE_CASES, analyzeCityUseCase, cityMeshMetrics, regions, scenarios, server, spatialGraph, state, views };