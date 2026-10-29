import { createProviderBootstrap } from './providers/bootstrap.mjs';
import { regions, scenarios, views, state, buildSpatialGraph } from './operator-state.mjs';
import {createLiveMapRuntime} from './providers/live-map-runtime.mjs';
import { appendFile, mkdir } from 'node:fs/promises';
import { createSessionRuntime } from './security/session-runtime.mjs';
import { publicHttpError } from './security/public-error.mjs';
import { readRequestJson as body } from './security/request-body.mjs';
import { createObservationStore } from './observation-store.mjs';
import { validateCoordinates } from "./providers/coordinate-validator.mjs";
import { createRequestContext } from './providers/request-context.mjs';
import { createPublicConfig } from './config/public-config.mjs';
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
import { runLocalQuboComparison } from './local-optimization-runtime.mjs';
import { AerBridgeError, probeQiskitAer, runQiskitAer } from './qiskit-aer-runtime.mjs';
import { createTerrainRuntime } from './terrain-runtime.mjs';
import { createCanonicalWebRuntime } from './web-runtime.mjs';
import { CITY_USE_CASES } from './analysis/city-use-cases.mjs';
import { cityMeshMetrics } from './analysis/city-metrics.mjs';
import { analyzeCityUseCase } from './analysis/city-planning.mjs';
import { computeOperatorOptimization } from './analysis/operator-optimization.mjs';

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
const observationStore = createObservationStore({dataDir});
const operatorQuotas = new Map();
const agentRuntime = createAgentRuntime({tools:{
  readObservations: async (context) => observationStore.list({lat:context.coordinate?.latitude,lon:context.coordinate?.longitude,at:context.temporalMode === 'historical' ? context.temporalCursor : undefined}),
}});
const cityEnvironmentRuntime = createCityEnvironmentRuntime({ fetchImpl: createPipelineFetch('weather') });
const cityLiveRuntime = createCityLiveRuntime({ fetchImpl: createPipelineFetch('air-quality') });
const geoRuntime = createGeoRuntime({ fetchImpl: createPipelineFetch('geo') });
const quantumRuntime = createQuantumRuntime();
const terrainRuntime = createTerrainRuntime({ fetchImpl: createPipelineFetch('terrain') });
providerRegistry.health.registerProvider('live-maps',{name:'Live aviation and radar',capability:'live-maps',capabilities:['aviation','radar'],status:'configured'});
const liveMapRuntime = createLiveMapRuntime({fetchImpl:createPipelineFetch('live-maps'),...providerRegistry.config.aviation});
const profileStore = createProfileStore({
  dataDir: process.env.AETHERGRID_DATA_DIR || join(root, '.aethergrid-data'),
});

const spatialGraph = buildSpatialGraph();
let activeCityMesh = null;

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

async function json(response, status, payload) {
  if (status === 200 && response.observation) {
    const data = payload.data || payload;
    const live = payload.receipt?.live === true || data.source?.live === true || data.airQuality?.source?.live === true;
    if (live) {
      try {
        const saved = await observationStore.record({...response.observation,payload:providerRegistry.redactor.redactValue(payload)});
        response.setHeader('x-aethergrid-observation',saved.receipt);
      } catch { return send(response,503,JSON.stringify({error:'observation_storage_unavailable'})); }
    }
  }
  send(response, status, JSON.stringify(payload, null, 2));
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
    metricsBasis: input.metrics ? 'operator-supplied-unverified' : 'illustrative-local-model',
    observationsRequiredForLiveClaims: true,
    externalContext: {
      geospatial: state.externalContext.geospatial,
      quantum: state.externalContext.quantum,
    },
    authority: 'advisory-only',
  };
}

function validateAgentRequest(input, id = 'TEAM') {
  if (!['TEAM', 'VÆLON', 'AUREN', 'SOLVÆR'].includes(id) ||
      !input || typeof input !== 'object' ||
      typeof input.message !== 'string' || !input.message.trim() ||
      input.message.length > 12000 ||
      (input.context != null && (typeof input.context !== 'object' || Array.isArray(input.context)))) {
    const error = new Error('A known agent, nonempty message (at most 12000 characters), and object context are required');
    error.status = 400;
    throw error;
  }
}

function agentEvidenceStatus(result) {
  if (result.runtime.provider === 'local' || result.runtime.fallbackUsed || result.runtime.error) return 'LOCAL_FALLBACK';
  if (result.contributions?.some(item => item.runtime.provider === 'local' || item.runtime.fallbackUsed || item.runtime.error)) return 'PARTIAL';
  return 'VERIFIED';
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

    const fileBridgePaths=['/api/aethergrid/health','/api/aethergrid/domains/aviation/aircraft'];
    if(['GET','OPTIONS'].includes(request.method) && request.headers.origin==='null' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname) && fileBridgePaths.includes(url.pathname)){
      response.setHeader('access-control-allow-origin','null');response.setHeader('vary','Origin');
      response.setHeader('access-control-allow-methods','GET, OPTIONS');response.setHeader('access-control-allow-private-network','true');
      if(request.method==='OPTIONS'){response.writeHead(204);response.end();return;}
    }
    const authPrefix = '/api/aethergrid/auth/';
    response.setHeader('cache-control','no-store');
    if (url.pathname.startsWith('/api/aethergrid/') && !['GET','HEAD'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && origin !== `http://${request.headers.host}` && origin !== process.env.AETHERGRID_PUBLIC_ORIGIN) return json(response,403,{error:'origin_rejected'});
    }
    if (request.method === 'GET' && url.pathname === `${authPrefix}session`) {
      const session = sessionRuntime.session(request);
      return json(response,200,{enabled:sessionRuntime.enabled,user:session?.user || null,csrf:session?.csrf || null});
    }
    if (request.method === 'POST' && url.pathname === `${authPrefix}login`) {
      const input=await body(request);
      const session=sessionRuntime.login(input.username,input.password,request.socket.remoteAddress);
      response.setHeader('set-cookie',`aethergrid_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.AETHERGRID_PUBLIC_ORIGIN?.startsWith('https:') ? '; Secure' : ''}`);
      return json(response,200,{enabled:true,user:session.user,csrf:session.csrf});
    }
    if (request.method === 'POST' && url.pathname === `${authPrefix}logout`) {
      const session=sessionRuntime.session(request);
      if(session && request.headers['x-aethergrid-csrf'] !== session.csrf) return json(response,403,{error:'csrf_rejected'});
      sessionRuntime.logout(request);
      response.setHeader('set-cookie','aethergrid_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return json(response,200,{ok:true});
    }
    const publicPaths=['/api/aethergrid/health','/api/aethergrid/config/public'];
    if(url.pathname.startsWith('/api/aethergrid/') && !publicPaths.includes(url.pathname)) {
      const session=sessionRuntime.authorize(request,request.method,url.pathname);
      request.operator=session.user;
      if(sessionRuntime.enabled && request.method === 'POST' && /\/(agents\/|team$|chat$|optimize$)/.test(url.pathname)) {
        const key=session.user.username;const window=operatorQuotas.get(key);
        const quota=window && window.until>Date.now() ? window : {count:0,until:Date.now()+60_000};
        operatorQuotas.set(key,quota);
        if(++quota.count>20) return json(response,429,{error:'operator_request_quota'});
      }
      if(!['GET','HEAD'].includes(request.method)) {
        await mkdir(dataDir,{recursive:true,mode:0o700});
        await appendFile(join(dataDir,'operator-audit.jsonl'),JSON.stringify({at:new Date().toISOString(),operator:session.user.username,role:session.user.role,method:request.method,path:url.pathname})+'\n',{mode:0o600});
      }
    }
    if(request.method === 'GET' && url.pathname === '/api/aethergrid/history') {
      const query={kind:url.searchParams.get('kind') || undefined,lat:url.searchParams.has('lat') ? Number(url.searchParams.get('lat')) : undefined,lon:url.searchParams.has('lon') ? Number(url.searchParams.get('lon')) : undefined,at:url.searchParams.get('at') || undefined};
      const observations=await observationStore.list(query);
      return json(response,200,{version:1,observations,source:'recorded-provider-observations',interpolated:false});
    }
    const observationKinds={'/api/aethergrid/weather/current':'weather','/api/aethergrid/environment':'environment','/api/aethergrid/city-live':'city-live'};
    const kind=observationKinds[url.pathname];
    if(request.method === 'GET' && kind && url.searchParams.has('at')) {
      const record=await observationStore.replay({kind,lat:Number(url.searchParams.get('lat')),lon:Number(url.searchParams.get('lon')),at:url.searchParams.get('at')});
      if(!record) return json(response,404,{error:'recorded_observation_unavailable'});
      response.setHeader('x-aethergrid-recorded-at',record.observedAt);
      response.setHeader('x-aethergrid-observation',record.receipt);
      return json(response,200,record.payload);
    }
    if(request.method === 'GET' && kind) {
      const coordinate=validateCoordinates(url.searchParams.get('lat'),url.searchParams.get('lon'));
      if(coordinate.valid) response.observation={kind,coordinate:{lat:Number(url.searchParams.get('lat')),lon:Number(url.searchParams.get('lon'))}};
    }
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

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/domains/aviation/aircraft') {
      try {
        const scope=url.searchParams.get('scope') || 'global';
        const result=await liveMapRuntime.aviation({scope,latitude:url.searchParams.get('latitude'),longitude:url.searchParams.get('longitude'),radiusKm:url.searchParams.get('radiusKm') ?? 250});
        return json(response,200,result);
      } catch(error) {return json(response,String(error.message).startsWith('Invalid')?400:503,{error:'aviation_unavailable',message:error.message,live:false});}
    }
    if (request.method === 'GET' && url.pathname === '/api/aethergrid/weather/radar') {
      try {return json(response,200,await liveMapRuntime.radar());}
      catch(error) {return json(response,503,{error:'radar_unavailable',message:error.message,live:false});}
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/weather/current') {
      const latParam = url.searchParams.get('lat');
      const lonParam = url.searchParams.get('lon');

      const coordVal = validateCoordinates(latParam, lonParam);
      if (!coordVal.valid) {
        return json(response, 400, {
          error: 'invalid_coordinates',
          message: coordVal.message,
          live: false,
        });
      }

      const { lat, lon } = coordVal;

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

      const coordVal = validateCoordinates(latParam, lonParam);
      if (!coordVal.valid) {
        return json(response, 400, {
          error: 'invalid_coordinates',
          message: coordVal.message,
          live: false,
        });
      }

      const { lat, lon } = coordVal;

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
      const latParam = url.searchParams.get('lat');
      const lonParam = url.searchParams.get('lon');
      if (latParam !== null || lonParam !== null) {
        const coordVal = validateCoordinates(latParam, lonParam);
        if (!coordVal.valid) {
          return json(response, 400, {
            error: 'invalid_coordinates',
            message: coordVal.message,
            live: false,
          });
        }
        const result = await nwsAlertsProvider.request(
          { lat: coordVal.lat, lon: coordVal.lon },
          execCtx,
        );
        return json(response, 200, providerRegistry.redactor.redactValue(result));
      }
      const result = await nwsAlertsProvider.request({}, execCtx);
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

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/transit/discovery') {
      const city = url.searchParams.get('city') || url.searchParams.get('query') || '';
      const latitude = url.searchParams.get('lat') ?? url.searchParams.get('latitude');
      const longitude = url.searchParams.get('lon') ?? url.searchParams.get('longitude');
      const radius = url.searchParams.get('radius');
      const limit = url.searchParams.get('limit');
      const result = await transitlandProvider.request(
        {
          city,
          query: city,
          ...(latitude !== null ? { lat: latitude } : {}),
          ...(longitude !== null ? { lon: longitude } : {}),
          ...(radius !== null ? { radius } : {}),
          ...(limit !== null ? { limit } : {}),
        },
        execCtx,
      );
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (
      request.method === 'GET' &&
      ['/api/aethergrid/transit/vehicles', '/api/aethergrid/transit/realtime'].includes(url.pathname)
    ) {
      const cityId = url.searchParams.get('cityId') || undefined;
      const result = await transitRegistry.adapter.request({ cityId }, execCtx);
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
      if (!payload.solver || typeof payload.solver !== 'string' || payload.solver.trim() === '' ) {
        return json(response, 400, { error: 'invalid_request', message: 'Explicit solver identifier is required for D-Wave problem submission.' });
      }
      if (!payload.problemType || typeof payload.problemType !== 'string' || payload.problemType.trim() === '' ) {
        return json(response, 400, { error: 'invalid_request', message: 'Explicit supported problemType is required for D-Wave problem submission.' });
      }
      if (!payload.problemPayload || (typeof payload.problemPayload === 'object' && Object.keys(payload.problemPayload).length === 0)) {
        return json(response, 400, { error: 'invalid_request', message: 'Actual encoded problem payload is required for D-Wave problem submission.' });
      }

      try {
        const result = await dwaveProvider.request(
          {
            action: 'submit',
            confirmSubmission: true,
            solver: payload.solver,
            problemType: payload.problemType,
            problemPayload: payload.problemPayload,
            parameters: payload.parameters || {},
          },
          execCtx,
        );
        return json(response, 200, providerRegistry.redactor.redactValue(result));
      } catch (err) {
        return json(response, 400, { error: 'invalid_request', message: err.message });
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/aethergrid/quantum/dwave/jobs/') && url.pathname.endsWith('/result')) {
      const parts = url.pathname.split('/');
      const problemId = parts[parts.length - 2];
      if (!problemId) {
        return json(response, 400, { error: 'invalid_request', message: 'Explicit problemId path parameter is required for D-Wave job result' });
      }
      try {
        const result = await dwaveProvider.request({ action: 'result', problemId }, execCtx);
        return json(response, 200, providerRegistry.redactor.redactValue(result));
      } catch (err) {
        return json(response, 400, { error: 'invalid_request', message: err.message });
      }
    }

if (request.method === 'GET' && url.pathname === '/api/aethergrid/runtime/providers') {
      const runtimeMetadata = providerRegistry.getSafePublicRuntimeMetadata();
      const safeRuntimeMetadata = {
        ...runtimeMetadata,
        transit: {
          ...runtimeMetadata.transit,
          configuredFeedCount: transitFeedConfig.metadata.configuredFeedCount,
          enabledFeedCount: transitFeedConfig.metadata.enabledFeedCount,
          cityCount: transitFeedConfig.metadata.cityCount,
          configSource: transitFeedConfig.metadata.source,
        },
      };
      return json(
        response,
        200,
        providerRegistry.redactor.redactValue(safeRuntimeMetadata),
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
      return json(response, 200, { profile: await (sessionRuntime.enabled ? createProfileStore({dataDir:join(dataDir, 'profiles', request.operator.username)}) : profileStore).load() });
    }

    if (request.method === 'PUT' && url.pathname === '/api/aethergrid/profile') {
      const input = await body(request);
      const profile = await (sessionRuntime.enabled ? createProfileStore({dataDir:join(dataDir, 'profiles', request.operator.username)}) : profileStore).save(input.profile || input);
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
      if (url.searchParams.get('spatial') === '1') {
        activeCityMesh = baseMesh;
        return json(response, 200, baseMesh);
      }
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
      const backgroundTile = url.searchParams.get('tile') === '1';
      const baseMesh = await geoRuntime.pointMesh(
        {
          lat: url.searchParams.get('lat'),
          lon: url.searchParams.get('lon'),
          name: url.searchParams.get('name') || 'Coordinate Explorer',
          radiusM: backgroundTile ? 450 : url.searchParams.get('radiusM') || 900,
        },
        {
          force: url.searchParams.get('force') === '1',
        },
      );
      if (url.searchParams.get('spatial') === '1') {
        // Streaming requests are observational and must not change the
        // operator's selected city or its downstream analysis context.
        if (!backgroundTile) activeCityMesh = baseMesh;
        return json(response, 200, baseMesh);
      }
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

    if (
      request.method === 'POST' &&
      url.pathname === '/api/aethergrid/quantum/optimization/local'
    ) {
      try {
        const input = await body(request);
        return json(response, 200, { result: runLocalQuboComparison(input) });
      } catch (error) {
        if (!(error instanceof TypeError) && !(error instanceof SyntaxError)) throw error;
        return json(response, 400, {
          error: 'invalid_qubo_problem',
          message: error.message,
        });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/qiskit/status') {
      return json(response, 200, await probeQiskitAer());
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/quantum/qiskit/run') {
      try {
        const input = await body(request);
        return json(response, 200, { result: await runQiskitAer(input) });
      } catch (error) {
        if (error instanceof AerBridgeError) {
          return json(response, error.status, { error: error.code, message: error.message });
        }
        if (error instanceof SyntaxError) {
          return json(response, 400, {
            error: 'invalid-circuit-input',
            message: 'Circuit request must be valid JSON',
          });
        }
        throw error;
      }
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

      const {
        objective,
        costWeight,
        emissionsWeight,
        minimumReservePercent,
        classicalBaselineRequired,
        currentCost,
        classicalCandidateCost,
        candidateCost,
        emissionsReduction,
        renewableUtilizationGain,
        reliabilityScore,
      } = computeOperatorOptimization(input, {
        scenario: state.system.scenario,
        scenarioParameters: state.system.scenarioParameters,
      });

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
      validateAgentRequest(input, agentId);
      const requestedContext = agentContext(input.context);
      const result = await agentRuntime.runAgent(agentId, {
        message: input.message,
        context: requestedContext,
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
        status: agentEvidenceStatus(result),
        receipt: result.receipt,
        details: {
          agent: agentId,
          provider: result.runtime.provider,
          model: result.runtime.model,
          fallbackUsed: result.runtime.fallbackUsed,
          latencyMs: result.runtime.latencyMs,
          region: requestedContext.region,
          scenario: requestedContext.scenario,
          temporalMode: requestedContext.temporalMode || 'live',
          temporalCursor: requestedContext.temporalCursor || null,
          selectedEntityId: requestedContext.selectedEntity?.id || null,
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
      validateAgentRequest(input);
      const requestedContext = agentContext(input.context);
      const result = await agentRuntime.runTeam({
        message: input.message,
        context: requestedContext,
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
        status: agentEvidenceStatus(result),
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
          region: requestedContext.region,
          scenario: requestedContext.scenario,
          temporalMode: requestedContext.temporalMode || 'live',
          temporalCursor: requestedContext.temporalCursor || null,
          selectedEntityId: requestedContext.selectedEntity?.id || null,
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
      validateAgentRequest(input, requestedAgent);
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

export { providerRegistry, CITY_USE_CASES, analyzeCityUseCase, cityMeshMetrics, regions, scenarios, server, spatialGraph, state, views };
