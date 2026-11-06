import { createAuthorizationHandler, createProfileRoutes } from './server/http/auth-routes.mjs';
import { createObservationHttp } from './server/http/observation-http.mjs';
import { createProviderRoutes } from './server/http/provider-routes.mjs';
import { createSpatialRoutes } from './server/http/spatial-routes.mjs';
import { createQuantumRoutes } from './server/http/quantum-routes.mjs';
import { createAgentRoutes } from './server/http/agent-routes.mjs';
import { createOperatorRoutes } from './server/http/operator-routes.mjs';
import { createProviderBootstrap } from './providers/bootstrap.mjs';
import { regions, scenarios, views, state, buildSpatialGraph } from './operator-state.mjs';
import { createLiveMapRuntime } from './providers/live-map-runtime.mjs';
import { createSessionRuntime } from './security/session-runtime.mjs';
import { publicHttpError } from './security/public-error.mjs';
import { createObservationStore } from './observation-store.mjs';
import { createRequestContext } from './providers/request-context.mjs';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAgentRuntime } from './ai-runtime.mjs';
import { createCityEnvironmentRuntime } from './city-environment-runtime.mjs';
import { createCityLiveRuntime } from './city-live-runtime.mjs';
import { createGeoRuntime } from './geo-runtime.mjs';
import { createProfileStore } from './profile-store.mjs';
import { createQuantumRuntime } from './quantum-runtime.mjs';
import { createOpenQuantumRuntime } from './openquantum-runtime.mjs';
import { createTerrainRuntime } from './terrain-runtime.mjs';
import { createCanonicalWebRuntime } from './web-runtime.mjs';
import { CITY_USE_CASES } from './analysis/city-use-cases.mjs';
import { cityMeshMetrics } from './analysis/city-metrics.mjs';
import { analyzeCityUseCase } from './analysis/city-planning.mjs';

const {
  providerRegistry,
  tomorrowWeatherProvider,
  nwsAlertsProvider,
  eiaProvider,
  noaaNwpsProvider,
  transitlandProvider,
  dwaveProvider,
  transitFeedConfig,
  transitRegistry,
  createPipelineFetch,
} = createProviderBootstrap();

const root = fileURLToPath(new URL('./', import.meta.url));
const canonicalWebRuntime = createCanonicalWebRuntime({ appRoot: root });
const port = Number(providerRegistry.config.app.port);

const dataDir = process.env.AETHERGRID_DATA_DIR || join(root, '.aethergrid-data');
const sessionRuntime = createSessionRuntime();
const observationStore = createObservationStore({ dataDir });
const agentRuntime = createAgentRuntime({
  tools: {
    readObservations: async (context) =>
      observationStore.list({
        lat: context.coordinate?.latitude,
        lon: context.coordinate?.longitude,
        at: context.temporalMode === 'historical' ? context.temporalCursor : undefined,
      }),
  },
});
const cityEnvironmentRuntime = createCityEnvironmentRuntime({
  fetchImpl: createPipelineFetch('weather'),
});
const cityLiveRuntime = createCityLiveRuntime({ fetchImpl: createPipelineFetch('air-quality') });
const geoRuntime = createGeoRuntime({ fetchImpl: createPipelineFetch('geo') });
const quantumRuntime = createQuantumRuntime();
const openQuantumRuntime = createOpenQuantumRuntime();
const terrainRuntime = createTerrainRuntime({ fetchImpl: createPipelineFetch('terrain') });
providerRegistry.health.registerProvider('live-maps', {
  name: 'Live aviation and radar',
  capability: 'live-maps',
  capabilities: ['aviation', 'radar'],
  status: 'configured',
});
const liveMapRuntime = createLiveMapRuntime({
  fetchImpl: createPipelineFetch('live-maps'),
  ...providerRegistry.config.aviation,
});
const profileStore = createProfileStore({
  dataDir: process.env.AETHERGRID_DATA_DIR || join(root, '.aethergrid-data'),
});

const spatialGraph = buildSpatialGraph();

function activity(message, type = 'system') {
  const item = {
    id: createHash('sha256').update(`${Date.now()}:${message}`).digest('hex').slice(0, 16),
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

function telemetryTick() {
  const now = Date.now();
  state.metrics.generationMw = Math.round(2130 + Math.sin(now / 8200) * 18);
  state.metrics.loadMw = Math.round(2410 + Math.cos(now / 9700) * 23);
  state.metrics.renewablePercent = Number((46.8 + Math.sin(now / 11500) * 1.35).toFixed(1));
  state.metrics.storageMw = Math.round(590 + Math.cos(now / 10400) * 10);
}

const { json, handleObservations } = createObservationHttp({ observationStore, providerRegistry });
const authorizeRequest = createAuthorizationHandler({ sessionRuntime, dataDir, json });
const routeFamilies = [
  createProviderRoutes({
    providerRegistry,
    tomorrowWeatherProvider,
    nwsAlertsProvider,
    eiaProvider,
    noaaNwpsProvider,
    transitlandProvider,
    transitFeedConfig,
    transitRegistry,
    liveMapRuntime,
    agentRuntime,
    geoRuntime,
    cityEnvironmentRuntime,
    cityLiveRuntime,
    terrainRuntime,
    quantumRuntime,
    profileStore,
    state,
    json,
  }),
  createProfileRoutes({ sessionRuntime, dataDir, profileStore, activity, state, json }),
  createSpatialRoutes({
    geoRuntime,
    terrainRuntime,
    cityEnvironmentRuntime,
    cityLiveRuntime,
    spatialGraph,
    state,
    activity,
    json,
  }),
  createQuantumRoutes({ quantumRuntime, openQuantumRuntime, dwaveProvider, providerRegistry, state, activity, json }),
  createOperatorRoutes({
    state,
    regions,
    scenarios,
    views,
    activity,
    snapshot,
    telemetryTick,
    json,
  }),
  createAgentRoutes({ agentRuntime, state, activity, json }),
];

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
    const context = { request, response, url, reqContext, execCtx };
    if (await authorizeRequest(context)) return;
    if (await handleObservations(context)) return;
    for (const handleRoutes of routeFamilies) {
      if (await handleRoutes(context)) return;
    }

    if (!['GET', 'HEAD'].includes(request.method || '')) {
      return json(response, 405, { error: 'method_not_allowed' });
    }

    if (url.pathname.startsWith('/api/')) {
      return json(response, 404, { error: 'not_found' });
    }

    return canonicalWebRuntime.serve(request, response, url);
  } catch (error) {
    if (error?.code === 'ENOENT') return json(response, 404, { error: 'not_found' });
    const { status, payload } = publicHttpError(error);
    return json(response, status, payload);
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(port, providerRegistry.config.app.bindAddress, () => {
    activity(`ÆTHERGRID backend started on port ${port}.`, 'system');
    process.stdout.write(`ÆTHERGRID app listening on http://127.0.0.1:${port}\n`);
  });
}

export {
  providerRegistry,
  CITY_USE_CASES,
  analyzeCityUseCase,
  cityMeshMetrics,
  regions,
  scenarios,
  server,
  spatialGraph,
  state,
  views,
};
