import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseHealthServiceConfig } from '../src/platform-health-service.mjs';
import { parseRuntimeConfig } from '../src/runtime-observability.mjs';

const ENV_EXAMPLE = new URL('../.env.example', import.meta.url);

function parseExample(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        assert.notEqual(separator, -1, `invalid .env.example line: ${line}`);
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

test('.env.example covers the maintained health and observability configuration', async () => {
  const values = parseExample(await readFile(ENV_EXAMPLE, 'utf8'));

  assert.deepEqual(
    Object.keys(values).sort(),
    [
      'AETHERGRID_AIR_QUALITY_PROVIDER',
      'AETHERGRID_AIR_QUALITY_URL',
      'AETHERGRID_AI_MODEL',
      'AETHERGRID_AI_PROVIDER',
      'AETHERGRID_AI_TIMEOUT_MS',
      'AETHERGRID_AUREN_MODEL',
      'AETHERGRID_AUREN_PROVIDER',
      'AETHERGRID_CESIUM_BASE_URL',
      'AETHERGRID_CESIUM_ION_TOKEN',
      'AETHERGRID_DATA_DIR',
      'AETHERGRID_DWAVE_API_TOKEN',
      'AETHERGRID_DWAVE_SOLVER_URL',
      'AETHERGRID_EIA_API_KEY',
      'AETHERGRID_EIA_BASE_URL',
      'AETHERGRID_ELEVATION_URL',
      'AETHERGRID_ENVIRONMENT_PROVIDER',
      'AETHERGRID_GEO_CACHE_TTL_MS',
      'AETHERGRID_GEO_PROVIDER',
      'AETHERGRID_GEO_USER_AGENT',
      'AETHERGRID_GOOGLE_3D_TILES_API_KEY',
      'AETHERGRID_GOOGLE_3D_TILES_URL',
      'AETHERGRID_HYDROLOGY_API_KEY',
      'AETHERGRID_HYDROLOGY_BASE_URL',
      'AETHERGRID_HYDROLOGY_PROVIDER',
      'AETHERGRID_IBM_IAM_URL',
      'AETHERGRID_IBM_QUANTUM_API_KEY',
      'AETHERGRID_IBM_QUANTUM_BACKEND',
      'AETHERGRID_IBM_QUANTUM_BASE_URL',
      'AETHERGRID_IBM_QUANTUM_SERVICE_CRN',
      'AETHERGRID_NWS_API_URL',
      'AETHERGRID_OLLAMA_BASE_URL',
      'AETHERGRID_OPENAI_API_KEY',
      'AETHERGRID_OPENAI_BASE_URL',
      'AETHERGRID_OPEN_METEO_API_KEY',
      'AETHERGRID_OPEN_METEO_URL',
      'AETHERGRID_OVERPASS_URL',
      'AETHERGRID_OVERTURE_API_KEY',
      'AETHERGRID_OVERTURE_MAPS_URL',
      'AETHERGRID_PORT',
      'AETHERGRID_QUANTUM_PROVIDER',
      'AETHERGRID_SEISMIC_CACHE_TTL_MS',
      'AETHERGRID_SEISMIC_PROVIDER',
      'AETHERGRID_SOLVAER_MODEL',
      'AETHERGRID_SOLVAER_PROVIDER',
      'AETHERGRID_TEAM_MODEL',
      'AETHERGRID_TEAM_PROVIDER',
      'AETHERGRID_TERRAIN_PROVIDER',
      'AETHERGRID_TOMORROW_IO_API_KEY',
      'AETHERGRID_TOMORROW_IO_URL',
      'AETHERGRID_TRANSIT_API_KEY',
      'AETHERGRID_TRANSIT_BASE_URL',
      'AETHERGRID_TRANSIT_PROVIDER',
      'AETHERGRID_USGS_EARTHQUAKE_URL',
      'AETHERGRID_VAELON_MODEL',
      'AETHERGRID_VAELON_PROVIDER',
      'GITHUB_SHA',
      'PORT',
      'RELEASE_TAG',
      'SERVICE_NAME',
      'THERGRID_LOG_LEVEL',
      'THERGRID_PORT',
    ].sort(),
  );

  assert.deepEqual(parseHealthServiceConfig(values), {
    PORT: 8080,
    SERVICE_NAME: 'thergrid',
  });
  assert.deepEqual(parseRuntimeConfig(values), {
    port: 8080,
    logLevel: 'info',
  });

  assert.equal(values.AETHERGRID_AI_PROVIDER, 'local');
  assert.equal(values.AETHERGRID_OPENAI_API_KEY, '');
  assert.equal(values.AETHERGRID_PORT, '8090');
});
