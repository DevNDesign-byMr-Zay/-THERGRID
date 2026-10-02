import { parseEnv } from './env-schema.mjs';

export function createProviderConfig(rawEnv = process.env) {
  const env = parseEnv(rawEnv);

  const effectivePort = env.AETHERGRID_PORT || env.PORT || 8090;

  return Object.freeze({
    app: Object.freeze({
      port: effectivePort,
      dataDir: env.AETHERGRID_DATA_DIR,
    }),
    ai: Object.freeze({
      provider: env.AETHERGRID_AI_PROVIDER,
      model: env.AETHERGRID_AI_MODEL,
      timeoutMs: env.AETHERGRID_AI_TIMEOUT_MS,
      openai: Object.freeze({
        baseUrl: env.AETHERGRID_OPENAI_BASE_URL,
        apiKey: env.AETHERGRID_OPENAI_API_KEY,
      }),
      ollama: Object.freeze({
        baseUrl: env.AETHERGRID_OLLAMA_BASE_URL,
      }),
      agentOverrides: Object.freeze({
        vaelon: Object.freeze({
          provider: env.AETHERGRID_VAELON_PROVIDER,
          model: env.AETHERGRID_VAELON_MODEL,
        }),
        auren: Object.freeze({
          provider: env.AETHERGRID_AUREN_PROVIDER,
          model: env.AETHERGRID_AUREN_MODEL,
        }),
        solvaer: Object.freeze({
          provider: env.AETHERGRID_SOLVAER_PROVIDER,
          model: env.AETHERGRID_SOLVAER_MODEL,
        }),
        team: Object.freeze({
          provider: env.AETHERGRID_TEAM_PROVIDER,
          model: env.AETHERGRID_TEAM_MODEL,
        }),
      }),
    }),
    geo: Object.freeze({
      provider: env.AETHERGRID_GEO_PROVIDER,
      overpassUrl: env.AETHERGRID_OVERPASS_URL,
      userAgent: env.AETHERGRID_GEO_USER_AGENT,
      cacheTtlMs: env.AETHERGRID_GEO_CACHE_TTL_MS,
    }),
    weather: Object.freeze({
      provider: env.AETHERGRID_ENVIRONMENT_PROVIDER,
      openMeteoUrl: env.AETHERGRID_OPEN_METEO_URL,
    }),
    airQuality: Object.freeze({
      provider: env.AETHERGRID_AIR_QUALITY_PROVIDER,
      airQualityUrl: env.AETHERGRID_AIR_QUALITY_URL,
    }),
    seismic: Object.freeze({
      provider: env.AETHERGRID_SEISMIC_PROVIDER,
      usgsEarthquakeUrl: env.AETHERGRID_USGS_EARTHQUAKE_URL,
      cacheTtlMs: env.AETHERGRID_SEISMIC_CACHE_TTL_MS,
    }),
    terrain: Object.freeze({
      provider: env.AETHERGRID_TERRAIN_PROVIDER,
      elevationUrl: env.AETHERGRID_ELEVATION_URL,
      openMeteoApiKey: env.AETHERGRID_OPEN_METEO_API_KEY,
    }),
    quantum: Object.freeze({
      provider: env.AETHERGRID_QUANTUM_PROVIDER,
      ibm: Object.freeze({
        baseUrl: env.AETHERGRID_IBM_QUANTUM_BASE_URL,
        iamUrl: env.AETHERGRID_IBM_IAM_URL,
        apiKey: env.AETHERGRID_IBM_QUANTUM_API_KEY,
        serviceCrn: env.AETHERGRID_IBM_QUANTUM_SERVICE_CRN,
        backend: env.AETHERGRID_IBM_QUANTUM_BACKEND,
      }),
    }),
    futureProviders: Object.freeze({
      cesium: Object.freeze({
        token: env.AETHERGRID_CESIUM_ION_TOKEN,
        baseUrl: env.AETHERGRID_CESIUM_BASE_URL,
      }),
      tomorrowIo: Object.freeze({
        apiKey: env.AETHERGRID_TOMORROW_IO_API_KEY,
        baseUrl: env.AETHERGRID_TOMORROW_IO_URL,
      }),
      google3d: Object.freeze({
        apiKey: env.AETHERGRID_GOOGLE_3D_TILES_API_KEY,
        baseUrl: env.AETHERGRID_GOOGLE_3D_TILES_URL,
      }),
      overture: Object.freeze({
        apiKey: env.AETHERGRID_OVERTURE_API_KEY,
        baseUrl: env.AETHERGRID_OVERTURE_MAPS_URL,
      }),
      eia: Object.freeze({
        apiKey: env.AETHERGRID_EIA_API_KEY,
        baseUrl: env.AETHERGRID_EIA_BASE_URL,
      }),
      dwave: Object.freeze({
        token: env.AETHERGRID_DWAVE_API_TOKEN,
        solverUrl: env.AETHERGRID_DWAVE_SOLVER_URL,
      }),
      nws: Object.freeze({
        apiUrl: env.AETHERGRID_NWS_API_URL,
      }),
      transit: Object.freeze({
        provider: env.AETHERGRID_TRANSIT_PROVIDER,
        apiKey: env.AETHERGRID_TRANSIT_API_KEY,
        baseUrl: env.AETHERGRID_TRANSIT_BASE_URL,
        feedsFile: env.AETHERGRID_GTFS_FEEDS_FILE,
      }),
      hydrology: Object.freeze({
        provider: env.AETHERGRID_HYDROLOGY_PROVIDER,
        apiKey: env.AETHERGRID_HYDROLOGY_API_KEY,
        baseUrl: env.AETHERGRID_HYDROLOGY_BASE_URL,
      }),
    }),
  });
}
