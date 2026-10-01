import { createProviderConfig } from '../config/provider-config.mjs';
import { createProviderHealth, PROVIDER_STATUS } from './provider-health.mjs';
import { createSecretRedactor } from '../security/secret-redactor.mjs';
import { createUrlPolicy } from '../security/url-policy.mjs';
import { createCacheStore } from './cache-store.mjs';
import { createCircuitBreaker } from './circuit-breaker.mjs';
import { createRateLimiter } from './rate-limiter.mjs';
import { createProviderExecutor } from './provider-executor.mjs';

export function createProviderRegistry(options = {}) {
  const rawEnv = options.env || process.env;
  const config = createProviderConfig(rawEnv);
  const health = createProviderHealth();
  const redactor = createSecretRedactor();
  redactor.registerSecretsFromConfig(config);

  const urlPolicy = createUrlPolicy([
    config.ai.openai.baseUrl,
    config.ai.ollama.baseUrl,
    config.geo.overpassUrl,
    config.weather.openMeteoUrl,
    config.airQuality.airQualityUrl,
    config.seismic.usgsEarthquakeUrl,
    config.terrain.elevationUrl,
    config.quantum.ibm.baseUrl,
    config.quantum.ibm.iamUrl,
    config.futureProviders.tomorrowIo.baseUrl || 'https://api.tomorrow.io/v4',
    config.futureProviders.nws.apiUrl || 'https://api.weather.gov',
    config.futureProviders.eia.baseUrl || 'https://api.eia.gov/v2',
    config.futureProviders.hydrology.baseUrl || 'https://api.water.noaa.gov/nwps/v1',
    config.futureProviders.dwave.solverUrl || 'https://cloud.dwavesys.com/sapi/v2',
  ]);

  const cache = createCacheStore();
  const breakers = new Map();
  const rateLimiters = new Map();

  function getBreaker(providerId) {
    if (!breakers.has(providerId)) {
      breakers.set(providerId, createCircuitBreaker({ name: providerId }));
    }
    return breakers.get(providerId);
  }

  function getRateLimiter(providerId) {
    if (!rateLimiters.has(providerId)) {
      rateLimiters.set(providerId, createRateLimiter({ name: providerId }));
    }
    return rateLimiters.get(providerId);
  }

  const executor = createProviderExecutor({
    urlPolicy,
    health,
    redactor,
    cache,
    getBreaker,
    getRateLimiter,
  });

  // Register initial readiness statuses for providers
  health.registerProvider('spatial', {
    name: 'Native WebGL 4D Grid',
    capabilities: ['spatial'],
    status: PROVIDER_STATUS.READY,
  });

  health.registerProvider('geo', {
    name: 'OpenStreetMap Overpass',
    capabilities: ['geo'],
    status: config.geo.provider === 'osm-overpass' ? PROVIDER_STATUS.READY : PROVIDER_STATUS.FALLBACK,
  });

  health.registerProvider('terrain', {
    name: config.terrain.provider === 'open-meteo' ? 'Open-Meteo Elevation (Copernicus DEM GLO-90)' : 'Flat Local Terrain',
    capabilities: ['terrain'],
    status: config.terrain.provider === 'open-meteo' ? PROVIDER_STATUS.READY : PROVIDER_STATUS.FALLBACK,
  });

  health.registerProvider('weather', {
    name: 'Open-Meteo Weather Forecast',
    capabilities: ['weather'],
    status: config.weather.provider === 'open-meteo' ? PROVIDER_STATUS.READY : PROVIDER_STATUS.FALLBACK,
  });

  health.registerProvider('air-quality', {
    name: 'Open-Meteo Air Quality',
    capabilities: ['air-quality'],
    status: config.airQuality.provider === 'open-meteo' ? PROVIDER_STATUS.READY : PROVIDER_STATUS.FALLBACK,
  });

  health.registerProvider('seismic', {
    name: 'USGS Earthquake Feed',
    capabilities: ['seismic'],
    status: config.seismic.provider === 'usgs' ? PROVIDER_STATUS.READY : PROVIDER_STATUS.FALLBACK,
  });

  const ibmConfigured = Boolean(config.quantum.ibm.apiKey && config.quantum.ibm.serviceCrn);
  health.registerProvider('quantum', {
    name: config.quantum.provider === 'ibm-quantum' ? 'IBM Quantum Compute' : 'Local Quantum Simulator',
    capabilities: ['quantum'],
    status: config.quantum.provider === 'ibm-quantum' && !ibmConfigured ? PROVIDER_STATUS.DEGRADED : PROVIDER_STATUS.READY,
    hardwareEnabled: ibmConfigured,
  });

  health.registerProvider('ai', {
    name: config.ai.provider === 'local' ? 'Local AI Runtime' : `AI Provider (${config.ai.provider})`,
    capabilities: ['ai'],
    status: config.ai.provider === 'local' ? PROVIDER_STATUS.READY : PROVIDER_STATUS.FALLBACK,
  });

  health.registerProvider('energy', {
    name: 'Local Microgrid Simulator & EIA Context',
    capabilities: ['energy'],
    status: PROVIDER_STATUS.READY,
  });

  health.registerProvider('hazards', {
    name: 'NWS Alerts Provider',
    capabilities: ['hazards'],
    status: PROVIDER_STATUS.READY,
  });

  health.registerProvider('transit', {
    name: config.futureProviders.transit.provider || 'GTFS-RT Transit Feed Registry',
    capabilities: ['transit'],
    status: config.futureProviders.transit.apiKey ? PROVIDER_STATUS.READY : PROVIDER_STATUS.UNCONFIGURED,
  });

  health.registerProvider('hydrology', {
    name: config.futureProviders.hydrology.provider || 'NOAA/NWPS Hydrology Provider',
    capabilities: ['hydrology'],
    status: config.futureProviders.hydrology.apiKey ? PROVIDER_STATUS.READY : PROVIDER_STATUS.UNCONFIGURED,
  });

  function executeProviderRequest(providerId, params = {}, fetcher, fallbackFetcher) {
    return executor.execute(providerId, params, fetcher, fallbackFetcher);
  }

  function getProvidersByCapability(capability) {
    const all = health.getAllStatuses();
    const matches = {};
    for (const [id, info] of Object.entries(all)) {
      if (info.capabilities && info.capabilities.includes(capability)) {
        matches[id] = info;
      }
    }
    return matches;
  }

  function getSafePublicRuntimeMetadata() {
    const healthStatuses = health.getAllStatuses();
    return Object.freeze({
      spatial: {
        provider: 'native-webgl',
        status: healthStatuses.spatial?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      geo: {
        provider: config.geo.provider,
        status: healthStatuses.geo?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      terrain: {
        provider: config.terrain.provider,
        status: healthStatuses.terrain?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      weather: {
        provider: config.weather.provider,
        status: healthStatuses.weather?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      airQuality: {
        provider: config.airQuality.provider,
        status: healthStatuses['air-quality']?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      seismic: {
        provider: config.seismic.provider,
        status: healthStatuses.seismic?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      quantum: {
        provider: config.quantum.provider,
        status: healthStatuses.quantum?.status || PROVIDER_STATUS.UNCONFIGURED,
        hardwareEnabled: ibmConfigured,
      },
      ai: {
        provider: config.ai.provider,
        status: healthStatuses.ai?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      energy: {
        provider: 'local-microgrid-simulator',
        status: healthStatuses.energy?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      hazards: {
        provider: 'nws-alerts',
        status: healthStatuses.hazards?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      transit: {
        status: healthStatuses.transit?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      hydrology: {
        status: healthStatuses.hydrology?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
    });
  }

  return {
    config,
    health,
    redactor,
    urlPolicy,
    cache,
    executor,
    getBreaker,
    getRateLimiter,
    executeProviderRequest,
    getProvidersByCapability,
    getSafePublicRuntimeMetadata,
  };
}
