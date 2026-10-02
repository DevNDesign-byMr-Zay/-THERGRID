import { createProviderConfig } from './provider-config.mjs';

export function createPublicConfig(rawConfigOrEnv = process.env) {
  const config =
    typeof rawConfigOrEnv.ai === 'object'
      ? rawConfigOrEnv
      : createProviderConfig(rawConfigOrEnv);

  const cesiumToken = config.futureProviders?.cesium?.token || '';
  const spatialProvider = cesiumToken ? 'cesium' : 'native-webgl';

  return Object.freeze({
    app: Object.freeze({
      port: config.app.port,
    }),
    spatial: Object.freeze({
      provider: spatialProvider,
      cesiumIonToken: cesiumToken,
      realityEnabled: Boolean(cesiumToken),
    }),
    ai: Object.freeze({
      provider: config.ai.provider,
      model: config.ai.model || undefined,
      timeoutMs: config.ai.timeoutMs,
      agentOverrides: config.ai.agentOverrides,
    }),
    geo: Object.freeze({
      provider: config.geo.provider,
      cacheTtlMs: config.geo.cacheTtlMs,
    }),
    weather: Object.freeze({
      provider: config.weather.provider,
    }),
    airQuality: Object.freeze({
      provider: config.airQuality.provider,
    }),
    seismic: Object.freeze({
      provider: config.seismic.provider,
      cacheTtlMs: config.seismic.cacheTtlMs,
    }),
    terrain: Object.freeze({
      provider: config.terrain.provider,
    }),
    quantum: Object.freeze({
      provider: config.quantum.provider,
      hardwareEnabled: Boolean(
        config.quantum.ibm.apiKey && config.quantum.ibm.serviceCrn,
      ),
    }),
    futureProviders: Object.freeze({
      cesiumConfigured: Boolean(config.futureProviders.cesium.token),
      tomorrowIoConfigured: Boolean(config.futureProviders.tomorrowIo.apiKey),
      google3dConfigured: Boolean(config.futureProviders.google3d.apiKey),
      overtureConfigured: Boolean(
        config.futureProviders.overture.apiKey || config.futureProviders.overture.baseUrl,
      ),
      eiaConfigured: Boolean(config.futureProviders.eia.apiKey),
      dwaveConfigured: Boolean(config.futureProviders.dwave.token),
      nwsConfigured: Boolean(config.futureProviders.nws.apiUrl),
      transitConfigured: Boolean(
        config.futureProviders.transit.apiKey ||
          config.futureProviders.transit.provider ||
          config.futureProviders.transit.feedsFile,
      ),
      hydrologyConfigured: Boolean(
        config.futureProviders.hydrology.apiKey || config.futureProviders.hydrology.provider,
      ),
    }),
  });
}
