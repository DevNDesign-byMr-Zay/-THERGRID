import { writeFile } from 'node:fs/promises';

import { createTomorrowWeatherProvider } from '../apps/aethergrid-console/providers/tomorrow-weather-provider.mjs';
import { createNwsAlertsProvider } from '../apps/aethergrid-console/providers/nws-alerts-provider.mjs';
import { createNoaaNwpsHydrologyProvider } from '../apps/aethergrid-console/providers/noaa-nwps-provider.mjs';
import { createEiaProvider } from '../apps/aethergrid-console/providers/eia-provider.mjs';
import { createDwaveProvider } from '../apps/aethergrid-console/providers/dwave-provider.mjs';
import { createQuantumRuntime } from '../apps/aethergrid-console/quantum-runtime.mjs';

const selected = String(
  process.env.AETHERGRID_LIVE_SMOKE_PROVIDER || process.argv[2] || 'all-safe',
).toLowerCase();
const latitude = Number(process.env.AETHERGRID_LIVE_SMOKE_LAT || 40.7128);
const longitude = Number(process.env.AETHERGRID_LIVE_SMOKE_LON || -74.006);
const nwpsGauge = String(process.env.AETHERGRID_LIVE_SMOKE_NWPS_GAUGE || '').trim();
const eiaRegion = String(process.env.AETHERGRID_LIVE_SMOKE_EIA_REGION || 'PJM').trim();
const outputPath = String(
  process.env.AETHERGRID_LIVE_SMOKE_OUTPUT || 'aethergrid-live-provider-smoke.json',
);

const allowed = new Set([
  'all-safe',
  'tomorrow',
  'nws',
  'nwps',
  'eia',
  'ibm',
  'dwave',
  'cesium-config',
]);

if (!allowed.has(selected)) {
  throw new Error(
    `Unknown live smoke provider '${selected}'. Expected one of: ${[...allowed].join(', ')}`,
  );
}

const report = {
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
    report.providers[name] = {
      state: 'not-configured',
      configured: false,
      ...details,
    };
    return;
  }

  const started = Date.now();
  try {
    const result = await task();
    report.providers[name] = {
      state: 'live-response-verified',
      configured: true,
      reachable: true,
      latencyMs: Date.now() - started,
      ...details,
      ...result,
    };
  } catch (error) {
    report.providers[name] = {
      state: 'failed',
      configured: true,
      reachable: false,
      latencyMs: Date.now() - started,
      ...details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

await runCheck(
  'tomorrow',
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

if (wants('cesium-config')) {
  const configured = Boolean(process.env.AETHERGRID_CESIUM_ION_TOKEN);
  report.providers['cesium-config'] = {
    state: configured ? 'configured' : 'not-configured',
    configured,
    liveResponseVerified: false,
    note: 'Configuration-only check; no token value is emitted.',
  };
}

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const attempted = Object.values(report.providers);
const failures = attempted.filter((item) => item.state === 'failed');

console.log(
  JSON.stringify(
    {
      outputPath,
      selected,
      checked: attempted.length,
      failed: failures.length,
      states: Object.fromEntries(
        Object.entries(report.providers).map(([name, value]) => [name, value.state]),
      ),
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  process.exitCode = 1;
}
