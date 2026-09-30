import { createProviderConfig } from '../config/provider-config.mjs';
import { createProviderHealth, PROVIDER_STATUS } from './provider-health.mjs';
import { createSecretRedactor } from '../security/secret-redactor.mjs';
import { createUrlPolicy } from '../security/url-policy.mjs';
import { createCacheStore } from './cache-store.mjs';
import { createCircuitBreaker } from './circuit-breaker.mjs';
import { createRateLimiter } from './rate-limiter.mjs';

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

  // Initialize standard providers into health tracking
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
    name: 'Local Microgrid Simulation',
    capabilities: ['energy'],
    status: PROVIDER_STATUS.READY,
  });

  health.registerProvider('transit', {
    name: config.futureProviders.transit.provider || 'Transit Provider',
    capabilities: ['transit'],
    status: config.futureProviders.transit.apiKey ? PROVIDER_STATUS.READY : PROVIDER_STATUS.UNCONFIGURED,
  });

  health.registerProvider('hydrology', {
    name: config.futureProviders.hydrology.provider || 'Hydrology Provider',
    capabilities: ['hydrology'],
    status: config.futureProviders.hydrology.apiKey ? PROVIDER_STATUS.READY : PROVIDER_STATUS.UNCONFIGURED,
  });

  function getProvidersByCapability(capability) {
    const all = health.getAllStatuses();
    const matches = {};
    for (const [id, info] of Object.entries(all)) {
      if (info.capabilities.includes(capability)) {
        matches[id] = info;
      }
    }
    return matches;
  }

  function getSafePublicRuntimeMetadata() {
    return Object.freeze({
      spatial: {
        provider: 'native-webgl',
        status: PROVIDER_STATUS.READY,
      },
      geo: {
        provider: config.geo.provider,
        status: health.getProviderStatus('geo')?.status || PROVIDER_STATUS.READY,
      },
      terrain: {
        provider: config.terrain.provider,
        status: health.getProviderStatus('terrain')?.status || PROVIDER_STATUS.READY,
      },
      weather: {
        provider: config.weather.provider,
        status: health.getProviderStatus('weather')?.status || PROVIDER_STATUS.READY,
      },
      airQuality: {
        provider: config.airQuality.provider,
        status: health.getProviderStatus('air-quality')?.status || PROVIDER_STATUS.READY,
      },
      seismic: {
        provider: config.seismic.provider,
        status: health.getProviderStatus('seismic')?.status || PROVIDER_STATUS.READY,
      },
      quantum: {
        provider: config.quantum.provider,
        status: health.getProviderStatus('quantum')?.status || PROVIDER_STATUS.READY,
        hardwareEnabled: ibmConfigured,
      },
      ai: {
        provider: config.ai.provider,
        status: health.getProviderStatus('ai')?.status || PROVIDER_STATUS.FALLBACK,
      },
      energy: {
        provider: 'local-microgrid-simulator',
        status: PROVIDER_STATUS.READY,
      },
      transit: {
        status: health.getProviderStatus('transit')?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
      hydrology: {
        status: health.getProviderStatus('hydrology')?.status || PROVIDER_STATUS.UNCONFIGURED,
      },
    });
  }

  return {
    config,
    health,
    redactor,
    urlPolicy,
    cache,
    getBreaker,
    getRateLimiter,
    getProvidersByCapability,
    getSafePublicRuntimeMetadata,
  };
}
