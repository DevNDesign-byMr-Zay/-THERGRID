import { z } from 'zod';

const optionalString = z.string().optional().default('');

const validateUrlString = (val) => {
  if (!val || val.trim() === '') return true;
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const defaultUrl = (defaultVal) =>
  z
    .string()
    .optional()
    .default(defaultVal)
    .refine(validateUrlString, { message: 'Invalid URL format; must be a valid HTTP or HTTPS URL' });

const optionalUrl = z
  .string()
  .optional()
  .default('')
  .refine(validateUrlString, { message: 'Invalid URL format; must be a valid HTTP or HTTPS URL' });

const numberFromEnv = (defaultValue) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === '') return defaultValue;
      const num = Number(val);
      return Number.isNaN(num) ? defaultValue : num;
    });

export const envSchema = z.object({
  // App / System
  AETHERGRID_PORT: numberFromEnv(8090),
  PORT: numberFromEnv(8090),
  AETHERGRID_DATA_DIR: z.string().optional().default('.aethergrid-data'),

  // AI
  AETHERGRID_AI_PROVIDER: z.string().optional().default('local'),
  AETHERGRID_AI_MODEL: optionalString,
  AETHERGRID_AI_TIMEOUT_MS: numberFromEnv(45000),
  AETHERGRID_OPENAI_BASE_URL: defaultUrl('https://api.openai.com/v1'),
  AETHERGRID_OPENAI_API_KEY: optionalString,
  AETHERGRID_OLLAMA_BASE_URL: defaultUrl('http://127.0.0.1:11434'),

  // Agent overrides
  AETHERGRID_VAELON_PROVIDER: optionalString,
  AETHERGRID_VAELON_MODEL: optionalString,
  AETHERGRID_AUREN_PROVIDER: optionalString,
  AETHERGRID_AUREN_MODEL: optionalString,
  AETHERGRID_SOLVAER_PROVIDER: optionalString,
  AETHERGRID_SOLVAER_MODEL: optionalString,
  AETHERGRID_TEAM_PROVIDER: optionalString,
  AETHERGRID_TEAM_MODEL: optionalString,

  // Geo / Spatial
  AETHERGRID_GEO_PROVIDER: z.string().optional().default('osm-overpass'),
  AETHERGRID_OVERPASS_URL: defaultUrl('https://overpass-api.de/api/interpreter'),
  AETHERGRID_GEO_USER_AGENT: z
    .string()
    .optional()
    .default('AETHERGRID/2.6 (operator-console; configure deployment contact)'),
  AETHERGRID_GEO_CACHE_TTL_MS: numberFromEnv(900000),

  // City Environment / Weather
  AETHERGRID_ENVIRONMENT_PROVIDER: z.string().optional().default('open-meteo'),
  AETHERGRID_OPEN_METEO_URL: defaultUrl('https://api.open-meteo.com/v1/forecast'),

  // Air Quality
  AETHERGRID_AIR_QUALITY_PROVIDER: z.string().optional().default('open-meteo'),
  AETHERGRID_AIR_QUALITY_URL: defaultUrl('https://air-quality-api.open-meteo.com/v1/air-quality'),

  // Seismic
  AETHERGRID_SEISMIC_PROVIDER: z.string().optional().default('usgs'),
  AETHERGRID_USGS_EARTHQUAKE_URL: defaultUrl(
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
  ),
  AETHERGRID_SEISMIC_CACHE_TTL_MS: numberFromEnv(60000),

  // Terrain
  AETHERGRID_TERRAIN_PROVIDER: z.string().optional().default('open-meteo'),
  AETHERGRID_ELEVATION_URL: defaultUrl('https://api.open-meteo.com/v1/elevation'),
  AETHERGRID_OPEN_METEO_API_KEY: optionalString,

  // Quantum
  AETHERGRID_QUANTUM_PROVIDER: z.string().optional().default('local-simulator'),
  AETHERGRID_IBM_QUANTUM_BASE_URL: defaultUrl('https://quantum.cloud.ibm.com/api/v1/'),
  AETHERGRID_IBM_IAM_URL: defaultUrl('https://iam.cloud.ibm.com/identity/token'),
  AETHERGRID_IBM_QUANTUM_API_KEY: optionalString,
  AETHERGRID_IBM_QUANTUM_SERVICE_CRN: optionalString,
  AETHERGRID_IBM_QUANTUM_BACKEND: optionalString,

  // Forward-compatible optional providers (Cesium, Tomorrow.io, Google 3D Tiles, Overture, EIA, D-Wave, NWS, Transit, Hydrology)
  AETHERGRID_CESIUM_ION_TOKEN: optionalString,
  AETHERGRID_CESIUM_BASE_URL: optionalUrl,
  AETHERGRID_TOMORROW_IO_API_KEY: optionalString,
  AETHERGRID_TOMORROW_IO_URL: optionalUrl,
  AETHERGRID_GOOGLE_3D_TILES_API_KEY: optionalString,
  AETHERGRID_GOOGLE_3D_TILES_URL: optionalUrl,
  AETHERGRID_OVERTURE_MAPS_URL: optionalUrl,
  AETHERGRID_OVERTURE_API_KEY: optionalString,
  AETHERGRID_EIA_API_KEY: optionalString,
  AETHERGRID_EIA_BASE_URL: optionalUrl,
  AETHERGRID_DWAVE_API_TOKEN: optionalString,
  AETHERGRID_DWAVE_SOLVER_URL: optionalUrl,
  AETHERGRID_NWS_API_URL: optionalUrl,
  AETHERGRID_TRANSIT_PROVIDER: optionalString,
  AETHERGRID_TRANSIT_API_KEY: optionalString,
  AETHERGRID_TRANSIT_BASE_URL: optionalUrl,
  AETHERGRID_HYDROLOGY_PROVIDER: optionalString,
  AETHERGRID_HYDROLOGY_API_KEY: optionalString,
  AETHERGRID_HYDROLOGY_BASE_URL: optionalUrl,
});

export function parseEnv(rawEnv = process.env) {
  return envSchema.parse(rawEnv);
}
