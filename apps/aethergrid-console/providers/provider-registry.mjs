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

  // Register exact provider IDs mapped to capabilities
  health.registerProvider('native-webgl', {
    name: 'Native WebGL 4D Grid',
    capability: 'spatial',
    capabilities: ['spatial'],
    status: PROVIDER_STATUS.READY,
  });

  health.registerProvider('osm-overpass', {
    name: 'OpenStreetMap Overpass',
    capability: 'geo',
    capabilities: ['geo'],
    status: config.geo.provider === 'osm-overpass' ? PROVIDER_STATUS.CONFIGURED : PROVIDER_STATUS.FALLBACK,
  });

  health.registerProvider('open-meteo-elevation', {
    name: 'Open-Meteo Elevation (Copernicus DEM GLO-90)',
    capability: 'terrain',
    capabilities: ['terrain'],
    status: config.terrain.provider === 'open-meteo' ? PROVIDER_STATUS.CONFIGURED : PROVIDER_STATUS.FALLBACK,
  });

  health.registerProvider('open-meteo-weather', {
    name: 'Open-Meteo Weather Forecast',
    capability: 'weather',
    capabilities: ['weather'],
    status: config.weather.provider === 'open-meteo' ? PROVIDER_STATUS.CONFIGURED : PROVIDER_STATUS.FALLBACK,
  });

  health.registerProvider('open-meteo-air-quality', {
    name: 'Open-Meteo Air Quality',
    capability: 'air-quality',
    capabilities: ['air-quality'],
    status: config.airQuality.provider === 'open-meteo' ? PROVIDER_STATUS.CONFIGURED : PROVIDER_STATUS.FALLBACK,
  });

  health.registerProvider('usgs', {
    name: 'USGS Earthquake Feed',
    capability: 'seismic',
    capabilities: ['seismic'],
    status: config.seismic.provider === 'usgs' ? PROVIDER_STATUS.CONFIGURED : PROVIDER_STATUS.FALLBACK,
  });

  health.registerProvider('tomorrow-io', {
    name: 'Tomorrow.io Weather API',
    capability: 'weather',
    capabilities: ['weather'],
    status: config.futureProviders.tomorrowIo.apiKey ? PROVIDER_STATUS.CONFIGURED : PROVIDER_STATUS.UNCONFIGURED,
  });

  health.registerProvider('nws', {
    name: 'US National Weather Service Alerts',
    capability: 'hazards',
    capabilities: ['hazards'],
    status: PROVIDER_STATUS.CONFIGURED,
  });

  health.registerProvider('noaa-nwps', {
    name: 'NOAA National Water Prediction Service',
    capability: 'hydrology',
    capabilities: ['hydrology'],
    status: PROVIDER_STATUS.CONFIGURED,
  });

  health.registerProvider('eia', {
    name: 'U.S. EIA Energy Context API v2',
    capability: 'energy',
    capabilities: ['energy'],
    status: config.futureProviders.eia.apiKey ? PROVIDER_STATUS.CONFIGURED : PROVIDER_STATUS.UNCONFIGURED,
  });

  health.registerProvider('gtfs-rt-registry', {
    name: 'GTFS-Realtime Transit Feed Registry',
    capability: 'transit',
    capabilities: ['transit'],
    status: PROVIDER_STATUS.UNCONFIGURED,
  });

  health.registerProvider('dwave', {
    name: 'D-Wave Ocean SAPI Quantum Cloud',
    capability: 'quantum',
    capabilities: ['quantum'],
    status: config.futureProviders.dwave.token ? PROVIDER_STATUS.CONFIGURED : PROVIDER_STATUS.UNCONFIGURED,
  });

  const ibmConfigured = Boolean(config.quantum.ibm.apiKey && config.quantum.ibm.serviceCrn);
  health.registerProvider('ibm-quantum', {
    name: 'IBM Quantum Compute',
    capability: 'quantum',
    capabilities: ['quantum'],
    status: ibmConfigured ? PROVIDER_STATUS.CONFIGURED : PROVIDER_STATUS.UNCONFIGURED,
    hardwareEnabled: ibmConfigured,
  });

  health.registerProvider('local-ai', {
    name: 'Local AI Runtime',
    capability: 'ai',
    capabilities: ['ai'],
    status: PROVIDER_STATUS.READY,
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
        status: healthStatuses['native-webgl']?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      geo: {
        provider: config.geo.provider,
        status: healthStatuses['osm-overpass']?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      terrain: {
        provider: config.terrain.provider,
        status: healthStatuses['open-meteo-elevation']?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      weather: {
        provider: config.weather.provider,
        status: healthStatuses['open-meteo-weather']?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      airQuality: {
        provider: config.airQuality.provider,
        status: healthStatuses['open-meteo-air-quality']?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      seismic: {
        provider: config.seismic.provider,
        status: healthStatuses.usgs?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      quantum: (() => {
        const ibm = healthStatuses['ibm-quantum'] || {};
        const dwave = healthStatuses.dwave || {};
        const selectedProvider = config.quantum.provider || 'local-simulator';

        let aggStatus = PROVIDER_STATUS.UNCONFIGURED;
        if (selectedProvider === 'local-simulator' || selectedProvider === 'local') {
          aggStatus = PROVIDER_STATUS.FALLBACK;
        } else if (selectedProvider === 'ibm-quantum' || selectedProvider === 'ibm') {
          aggStatus = ibm.status || PROVIDER_STATUS.UNCONFIGURED;
        } else if (selectedProvider === 'dwave') {
          aggStatus = dwave.status || PROVIDER_STATUS.UNCONFIGURED;
        } else {
          // Aggregate rule: if either remote provider is ready/configured, return that status
          const activeStatuses = [ibm.status, dwave.status].filter(Boolean);
          if (activeStatuses.includes(PROVIDER_STATUS.READY)) {
            aggStatus = PROVIDER_STATUS.READY;
          } else if (activeStatuses.includes(PROVIDER_STATUS.CONFIGURED)) {
            aggStatus = PROVIDER_STATUS.CONFIGURED;
          } else if (activeStatuses.includes(PROVIDER_STATUS.DEGRADED)) {
            aggStatus = PROVIDER_STATUS.DEGRADED;
          }
        }

        return {
          provider: selectedProvider,
          status: aggStatus,
          hardwareEnabled: Boolean(ibm.hardwareEnabled || dwave.hardwareEnabled || ibmConfigured || config.futureProviders.dwave.token),
          providers: {
            ibm: {
              status: ibm.status || PROVIDER_STATUS.UNCONFIGURED,
              configured: Boolean(ibmConfigured),
              hardwareEnabled: Boolean(ibmConfigured),
              lastLiveSuccessAt: ibm.lastLiveSuccessAt || null,
              lastFailureAt: ibm.lastFailureAt || null,
            },
            dwave: {
              status: dwave.status || PROVIDER_STATUS.UNCONFIGURED,
              configured: Boolean(config.futureProviders.dwave.token),
              hardwareEnabled: Boolean(config.futureProviders.dwave.token),
              lastLiveSuccessAt: dwave.lastLiveSuccessAt || null,
              lastFailureAt: dwave.lastFailureAt || null,
            },
          },
        };
      })(),
      ai: {
        provider: config.ai.provider,
        status: healthStatuses['local-ai']?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      energy: {
        provider: 'eia',
        status: healthStatuses.eia?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      hazards: {
        provider: 'nws',
        status: healthStatuses.nws?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      transit: {
        status: healthStatuses['gtfs-rt-registry']?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      hydrology: {
        status: healthStatuses['noaa-nwps']?.status || PROVIDER_STATUS.UNCONFIGURED,
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
