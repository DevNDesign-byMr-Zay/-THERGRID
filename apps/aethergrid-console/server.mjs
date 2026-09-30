import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAgentRuntime } from './ai-runtime.mjs';
import { createGeoRuntime } from './geo-runtime.mjs';
import { createProfileStore } from './profile-store.mjs';
import { createQuantumRuntime } from './quantum-runtime.mjs';
import { createTerrainRuntime } from './terrain-runtime.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const port = Number(process.env.AETHERGRID_PORT || process.env.PORT || 8090);
const agentRuntime = createAgentRuntime();
const geoRuntime = createGeoRuntime();
const quantumRuntime = createQuantumRuntime();
const terrainRuntime = createTerrainRuntime();
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

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/runtime') {
      const ai = agentRuntime.summary();
      return json(response, 200, {
        ...ai,
        ai,
        geospatial: geoRuntime.summary(),
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
      const mesh = await geoRuntime.cityMesh(cityId, {
        force: url.searchParams.get('force') === '1',
      });
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
      const mesh = await geoRuntime.pointMesh(
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
      const result = await quantumRuntime.submitSampler({
        circuit: input.circuit,
        backend: input.backend,
        shots: input.shots,
      });
      const record = {
        id: result.receipt.slice(0, 16),
        title: `Quantum Job: ${result.backend}`,
        type: 'QUANTUM_JOB',
        age: 'just now',
        status: result.status === 'COMPLETED' ? 'VERIFIED' : 'PENDING',
        receipt: result.receipt,
        details: {
          provider: result.provider,
          backend: result.backend,
          programId: result.programId,
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
        status: result.status,
        hardwareSubmitted: Boolean(result.hardwareSubmitted),
        hardwareExecuted: Boolean(result.hardwareExecuted),
        receipt: result.receipt,
      };
      activity(
        `Quantum sampler job ${result.id} submitted through ${result.provider}/${result.backend}; status ${result.status}.`,
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

export { regions, scenarios, server, spatialGraph, state, views };