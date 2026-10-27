import { createTomorrowWeatherProvider } from './tomorrow-weather-provider.mjs';
import { createNwsAlertsProvider } from './nws-alerts-provider.mjs';
import { createNoaaNwpsHydrologyProvider } from './noaa-nwps-provider.mjs';
import { createEiaProvider } from './eia-provider.mjs';
import { createTransitRegistry } from './transit-registry.mjs';
import { createTransitlandProvider } from './transitland-provider.mjs';
import { loadTransitFeedConfig } from './transit-feed-config.mjs';
import { createDwaveProvider } from './dwave-provider.mjs';
import { createProviderRegistry } from './provider-registry.mjs';

export function createProviderBootstrap({ env = process.env, fetchImpl = fetch } = {}) {
  const providerRegistry = createProviderRegistry({ env });

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

  const transitlandProvider = createTransitlandProvider({
    apiKey: providerRegistry.config.futureProviders.transit.apiKey,
    baseUrl: providerRegistry.config.futureProviders.transit.baseUrl,
  });
  providerRegistry.health.registerProvider('transitland', {
    id: 'transitland',
    name: 'Transitland v2 Catalog Discovery Provider',
    capability: 'transit-discovery',
    capabilities: ['transit-discovery', 'agency-catalog'],
  });

  const dwaveProvider = createDwaveProvider({
    token: providerRegistry.config.providers.dwave.token,
    baseUrl: providerRegistry.config.providers.dwave.baseUrl || providerRegistry.config.providers.dwave.solverUrl,
  });

  const transitFeedConfig = loadTransitFeedConfig(
    providerRegistry.config.futureProviders.transit.feedsFile,
    { env },
  );

  for (const feed of Object.values(transitFeedConfig.feeds)) {
    providerRegistry.urlPolicy.addAllowedOrigin(feed.feedUrl);
  }

  const transitRegistry = createTransitRegistry({ feeds: transitFeedConfig.feeds });
  providerRegistry.health.updateStatus(
    'gtfs-rt-registry',
    transitFeedConfig.metadata.enabledFeedCount > 0 ? 'configured' : 'unconfigured',
    {
      message:
        transitFeedConfig.metadata.enabledFeedCount > 0
          ? `${transitFeedConfig.metadata.enabledFeedCount} GTFS-Realtime production feed(s) configured`
          : 'No GTFS-Realtime production feeds configured',
    },
  );

  function createPipelineFetch(providerId) {
    return async (url, options) => {
      const targetUrl = typeof url === 'string' ? url : url.toString();
      providerRegistry.urlPolicy.validateUrl(targetUrl);

      const breaker = providerRegistry.getBreaker(providerId);
      const startTime = Date.now();
      try {
        const res = await fetchImpl(url, options);
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

  return {
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
  };
}
