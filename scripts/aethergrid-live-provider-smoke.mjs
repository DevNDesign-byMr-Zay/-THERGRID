import { writeFile } from 'node:fs/promises';

import { createTomorrowWeatherProvider } from '../apps/aethergrid-console/providers/tomorrow-weather-provider.mjs';
import { createNwsAlertsProvider } from '../apps/aethergrid-console/providers/nws-alerts-provider.mjs';
import { createNoaaNwpsHydrologyProvider } from '../apps/aethergrid-console/providers/noaa-nwps-provider.mjs';
import { createEiaProvider } from '../apps/aethergrid-console/providers/eia-provider.mjs';
import { createDwaveProvider } from '../apps/aethergrid-console/providers/dwave-provider.mjs';
import { createTransitlandProvider } from '../apps/aethergrid-console/providers/transitland-provider.mjs';
import { createQuantumRuntime } from '../apps/aethergrid-console/quantum-runtime.mjs';
import { createCityEnvironmentRuntime } from '../apps/aethergrid-console/city-environment-runtime.mjs';
import { createGeoRuntime } from '../apps/aethergrid-console/geo-runtime.mjs';
import { createAgentRuntime } from '../apps/aethergrid-console/ai-runtime.mjs';
import { loadTransitFeedConfig } from '../apps/aethergrid-console/providers/transit-feed-config.mjs';
import { createTransitRegistry } from '../apps/aethergrid-console/providers/transit-registry.mjs';
import { createSecretRedactor } from '../apps/aethergrid-console/security/secret-redactor.mjs';

const redactor = createSecretRedactor();
redactor.registerSecretsFromConfig(process.env);

const rawSelected = String(
  process.env.AETHERGRID_LIVE_SMOKE_PROVIDER || process.argv[2] || 'all-safe',
).toLowerCase();

const selected = rawSelected === 'tomorrow' ? 'tomorrow-realtime' : rawSelected;

const latitude = Number(process.env.AETHERGRID_LIVE_SMOKE_LAT || 40.7128);
const longitude = Number(process.env.AETHERGRID_LIVE_SMOKE_LON || -74.006);
const nwpsGauge = String(process.env.AETHERGRID_LIVE_SMOKE_NWPS_GAUGE || '').trim();
const eiaRegion = String(process.env.AETHERGRID_LIVE_SMOKE_EIA_REGION || 'PJM').trim();
const outputPath = String(
  process.env.AETHERGRID_LIVE_SMOKE_OUTPUT || 'aethergrid-live-provider-smoke.json',
);

const allowed = new Set([
  'all-safe',
  'open-meteo-weather',
  'open-meteo-forecast',
  'open-meteo-air-quality',
  'open-meteo-elevation',
  'usgs',
  'nws',
  'nwps',
  'overpass',
  'groq',
  'tomorrow-realtime',
  'tomorrow-forecast',
  'eia',
  'transitland',
  'gtfs',
  'ibm',
  'dwave',
  'cesium-config',
]);

if (!allowed.has(selected)) {
  throw new Error(
    `Unknown live smoke provider '${selected}'. Expected one of: ${[...allowed].join(', ')}`,
  );
}

const rawReport = {
  schemaVersion: 1,
  runAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || null,
  selected,
  providers: {},
};

function wants(name) {
  return selected === 'all-safe' || selected === name;
}

async function runCheck(name, configured, task, details = {}) {
  if (!wants(name)) return;
  if (!configured) {
    rawReport.providers[name] = {
      state: 'not-configured',
      configured: false,
      ...details,
    };
    return;
  }

  const started = Date.now();
  try {
    const result = await task();
    rawReport.providers[name] = {
      state: 'live-response-verified',
      configured: true,
      reachable: true,
      latencyMs: Date.now() - started,
      retrievedAt: new Date().toISOString(),
      ...details,
      ...result,
    };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    rawReport.providers[name] = {
      state: 'failed',
      configured: true,
      reachable: false,
      latencyMs: Date.now() - started,
      ...details,
      error: redactor.redactString(rawMsg),
    };
  }
}

// 1. OPEN-METEO WEATHER
await runCheck(
  'open-meteo-weather',
  true,
  async () => {
    const envRuntime = createCityEnvironmentRuntime({ env: process.env });
    const data = await envRuntime.current(latitude, longitude);
    return {
      live: data.source?.live === true,
      provider: data.source?.provider || 'open-meteo',
      retrievedAt: data.source?.fetchedAt || new Date().toISOString(),
      temperature: data.current?.temperatureC ?? null,
    };
  },
  { coordinates: { latitude, longitude } },
);

// 2. OPEN-METEO FORECAST
await runCheck(
  'open-meteo-forecast',
  true,
  async () => {
    const envRuntime = createCityEnvironmentRuntime({ env: process.env });
    const data = await envRuntime.forecast(latitude, longitude);
    return {
      live: data.source?.live === true,
      provider: data.source?.provider || 'open-meteo',
      retrievedAt: data.source?.fetchedAt || new Date().toISOString(),
      hourlyCount: Array.isArray(data.hourly) ? data.hourly.length : 0,
    };
  },
  { coordinates: { latitude, longitude } },
);

// 3. OPEN-METEO AIR QUALITY
await runCheck(
  'open-meteo-air-quality',
  true,
  async () => {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`Open-Meteo Air Quality HTTP ${resp.status}`);
    const json = await resp.json();
    return {
      live: true,
      provider: 'open-meteo',
      usAqi: json.current?.us_aqi ?? null,
    };
  },
  { coordinates: { latitude, longitude } },
);

// 4. OPEN-METEO ELEVATION
await runCheck(
  'open-meteo-elevation',
  true,
  async () => {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`Open-Meteo Elevation HTTP ${resp.status}`);
    const json = await resp.json();
    const elev = Array.isArray(json.elevation) ? json.elevation[0] : json.elevation;
    return {
      live: true,
      provider: 'open-meteo',
      elevationMeters: elev ?? null,
    };
  },
  { coordinates: { latitude, longitude } },
);

// 5. USGS EARTHQUAKES
await runCheck(
  'usgs',
  true,
  async () => {
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`USGS Earthquake Feed HTTP ${resp.status}`);
    const json = await resp.json();
    return {
      live: true,
      provider: 'usgs',
      featureCount: Array.isArray(json.features) ? json.features.length : 0,
    };
  },
  {},
);

// 6. NWS ALERTS
await runCheck(
  'nws',
  true,
  async () => {
    const provider = createNwsAlertsProvider({
      baseUrl: process.env.AETHERGRID_NWS_API_URL,
      userAgent:
        process.env.AETHERGRID_GEO_USER_AGENT ||
        'AETHERGRID/4.0 live-smoke (configure deployment contact)',
    });
    const result = await provider.request({ lat: latitude, lon: longitude });
    return {
      live: result.receipt?.live === true,
      alertCount: Number(result.data?.count || 0),
      dataset: result.receipt?.dataset || 'active-alerts',
    };
  },
  { coordinates: { latitude, longitude } },
);

// 7. NOAA NWPS
await runCheck(
  'nwps',
  Boolean(nwpsGauge),
  async () => {
    const provider = createNoaaNwpsHydrologyProvider({
      baseUrl: process.env.AETHERGRID_HYDROLOGY_BASE_URL,
    });
    const result = await provider.request({ gaugeId: nwpsGauge });
    return {
      live: result.receipt?.live === true,
      gaugeId: nwpsGauge,
      dataset: result.receipt?.dataset || 'nwps-gauge',
    };
  },
  nwpsGauge ? { gaugeId: nwpsGauge } : { reason: 'AETHERGRID_LIVE_SMOKE_NWPS_GAUGE not set' },
);

// 8. OSM OVERPASS
await runCheck(
  'overpass',
  true,
  async () => {
    const geoRuntime = createGeoRuntime({ env: process.env });
    const data = await geoRuntime.pointMesh({ lat: latitude, lon: longitude });
    return {
      live: Boolean(data && data.buildings),
      buildingCount: Array.isArray(data?.buildings) ? data.buildings.length : 0,
    };
  },
  { coordinates: { latitude, longitude } },
);

// 9. GROQ / AI RUNTIME
await runCheck(
  'groq',
  Boolean(process.env.AETHERGRID_OPENAI_API_KEY),
  async () => {
    const aiRuntime = createAgentRuntime({ env: process.env });
    const summary = aiRuntime.status();
    return {
      live: summary.configured === true,
      provider: summary.provider,
      model: summary.model,
      configured: summary.configured,
    };
  },
  {},
);

// 10. TOMORROW.IO REALTIME
await runCheck(
  'tomorrow-realtime',
  Boolean(process.env.AETHERGRID_TOMORROW_IO_API_KEY),
  async () => {
    const provider = createTomorrowWeatherProvider({
      apiKey: process.env.AETHERGRID_TOMORROW_IO_API_KEY,
      baseUrl: process.env.AETHERGRID_TOMORROW_IO_URL,
    });
    const result = await provider.request({
      lat: latitude,
      lon: longitude,
      mode: 'realtime',
    });
    return {
      live: result.receipt?.live === true,
      observedAt: result.data?.observedAt || null,
      dataset: result.receipt?.dataset || 'weather-realtime',
    };
  },
  { coordinates: { latitude, longitude } },
);

// 11. TOMORROW.IO FORECAST
await runCheck(
  'tomorrow-forecast',
  Boolean(process.env.AETHERGRID_TOMORROW_IO_API_KEY),
  async () => {
    const provider = createTomorrowWeatherProvider({
      apiKey: process.env.AETHERGRID_TOMORROW_IO_API_KEY,
      baseUrl: process.env.AETHERGRID_TOMORROW_IO_URL,
    });
    const result = await provider.request({
      lat: latitude,
      lon: longitude,
      mode: 'forecast',
    });
    return {
      live: result.receipt?.live === true,
      observedAt: result.data?.retrievedAt || null,
      dataset: result.receipt?.dataset || 'weather-forecast',
    };
  },
  { coordinates: { latitude, longitude } },
);

// 12. EIA
await runCheck(
  'eia',
  Boolean(process.env.AETHERGRID_EIA_API_KEY),
  async () => {
    const provider = createEiaProvider({
      apiKey: process.env.AETHERGRID_EIA_API_KEY,
      baseUrl: process.env.AETHERGRID_EIA_BASE_URL,
    });
    const result = await provider.request({ region: eiaRegion });
    return {
      live: result.receipt?.live === true,
      region: eiaRegion,
      itemCount: Array.isArray(result.data?.fuelMix) ? result.data.fuelMix.length : 0,
      dataset: result.receipt?.dataset || 'electricity-fuel-mix',
    };
  },
  { region: eiaRegion },
);

// 13. TRANSITLAND
await runCheck(
  'transitland',
  Boolean(process.env.AETHERGRID_TRANSIT_API_KEY),
  async () => {
    const provider = createTransitlandProvider({
      apiKey: process.env.AETHERGRID_TRANSIT_API_KEY,
      baseUrl: process.env.AETHERGRID_TRANSIT_BASE_URL,
    });
    const result = await provider.request({ city: 'New York' });
    return {
      live: result.receipt?.live === true,
      agencyCount: result.data?.agencyCount ?? 0,
      feedCount: Array.isArray(result.data?.feeds) ? result.data.feeds.length : 0,
    };
  },
  {},
);

// 14. GTFS
await runCheck(
  'gtfs',
  Boolean(process.env.AETHERGRID_GTFS_FEEDS_FILE),
  async () => {
    const transitConfig = loadTransitFeedConfig(process.env.AETHERGRID_GTFS_FEEDS_FILE);
    const registry = createTransitRegistry({ feeds: transitConfig.feeds });
    return {
      live: transitConfig.metadata.enabledFeedCount > 0,
      configuredFeedCount: transitConfig.metadata.configuredFeedCount,
      enabledFeedCount: transitConfig.metadata.enabledFeedCount,
      cityCount: transitConfig.metadata.cityCount,
    };
  },
  {},
);

// 15. IBM QUANTUM (Discovery Only)
await runCheck(
  'ibm',
  Boolean(
    process.env.AETHERGRID_IBM_QUANTUM_API_KEY && process.env.AETHERGRID_IBM_QUANTUM_SERVICE_CRN,
  ),
  async () => {
    const runtime = createQuantumRuntime({
      env: {
        ...process.env,
        AETHERGRID_QUANTUM_PROVIDER: 'ibm-quantum',
      },
    });
    const result = await runtime.listBackends();
    return {
      live: true,
      discoveryOnly: true,
      hardwareSubmitted: false,
      hardwareExecuted: false,
      backendCount: Array.isArray(result.backends) ? result.backends.length : 0,
      apiVersion: runtime.summary().apiVersion,
    };
  },
  { discoveryOnly: true, hardwareSubmitted: false, hardwareExecuted: false },
);

// 16. D-WAVE QUANTUM (Discovery Only)
await runCheck(
  'dwave',
  Boolean(process.env.AETHERGRID_DWAVE_API_TOKEN),
  async () => {
    const provider = createDwaveProvider({
      token: process.env.AETHERGRID_DWAVE_API_TOKEN,
      solverUrl: process.env.AETHERGRID_DWAVE_SOLVER_URL,
    });
    const result = await provider.request({ action: 'discover' });
    return {
      live: result.receipt?.live === true,
      discoveryOnly: true,
      hardwareSubmitted: false,
      hardwareExecuted: false,
      solverCount: Array.isArray(result.data?.solvers) ? result.data.solvers.length : 0,
    };
  },
  { discoveryOnly: true, hardwareSubmitted: false, hardwareExecuted: false },
);

// 17. CESIUM CONFIG
if (wants('cesium-config')) {
  const configured = Boolean(process.env.AETHERGRID_CESIUM_ION_TOKEN);
  rawReport.providers['cesium-config'] = {
    state: configured ? 'configured' : 'not-configured',
    configured,
    liveResponseVerified: false,
    note: 'Configuration-only check; no token value is emitted.',
  };
}

const report = redactor.redactValue(rawReport);

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const attempted = Object.values(report.providers);
const failures = attempted.filter((item) => item.state === 'failed');

console.log(
  JSON.stringify(
    redactor.redactValue({
      outputPath,
      selected,
      checked: attempted.length,
      failed: failures.length,
      states: Object.fromEntries(
        Object.entries(report.providers).map(([name, value]) => [name, value.state]),
      ),
    }),
    null,
    2,
  ),
);

if (failures.length > 0) {
  process.exitCode = 1;
}
