import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import {
  summarizeAgent,
  summarizeProvider,
  summarizeObservation,
  summarizeScheduledRealtime,
  sanitizeAcceptance,
} from './lib/canonical-acceptance.mjs';

const base = 'http://127.0.0.1:8090';
const report = {
  schemaVersion: 1,
  commit: process.env.GITHUB_SHA || null,
  runAt: new Date().toISOString(),
  canonical: true,
  providers: {},
  hardwareSubmitted: false,
  hardwareExecuted: false,
};
const server = spawn(process.execPath, ['apps/aethergrid-console/server.mjs'], {
  env: { ...process.env, AETHERGRID_PORT: '8090' },
  stdio: 'ignore',
});
async function request(path, input) {
  const response = await fetch(`${base}${path}`, {
    ...(input
      ? {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        }
      : {}),
    signal: AbortSignal.timeout(150000),
  });
  if (!response.ok) throw new Error(`canonical API returned HTTP ${response.status}`);
  return response.json();
}
async function check(name, task) {
  try {
    const result = await task();
    report.providers[name] = {
      ...result,
      state: result.verified
        ? result.acceptanceState || 'live-response-verified'
        : 'degraded',
    };
  } catch {
    report.providers[name] = {
      state: 'unavailable',
      verified: false,
      reason: 'canonical request failed; raw upstream error deliberately withheld',
    };
  }
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error('canonical server exited before readiness');
    try {
      const response = await fetch(`${base}/`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && /id=["']root["']/.test(await response.text())) {
        ready = true;
        break;
      }
    } catch {
      /* server starting */
    }
    await delay(500);
  }
  if (!ready) throw new Error('canonical React production root did not become ready');
  for (const agent of ['VÆLON', 'AUREN', 'SOLVÆR']) {
    await check(`groq-${agent}`, async () =>
      summarizeAgent(
        await request(`/api/aethergrid/agents/${encodeURIComponent(agent)}`, {
          message: 'Reply briefly with READY and confirm advisory-only operation.',
          context: {},
        }),
        agent,
      ),
    );
  }
  // Give the account's token bucket time to refill before four TEAM model calls.
  await delay(30000);
  await check('groq-TEAM', async () =>
    summarizeAgent(
      await request('/api/aethergrid/team', {
        message:
          'Give a very brief readiness synthesis. Each contribution must stay under 20 words; preserve advisory-only operation.',
        context: {},
      }),
      'TEAM',
    ),
  );
  const coordinates = 'lat=40.7128&lon=-74.006';
  await check('tomorrow-current', async () =>
    summarizeObservation(
      await request(`/api/aethergrid/weather/current?${coordinates}`),
      'tomorrow-current',
    ),
  );
  await check('tomorrow-forecast', async () => {
    const result = await request(`/api/aethergrid/weather/forecast?${coordinates}`);
    return summarizeProvider(result, 'tomorrow-io', {
      records: (result.data?.timesteps || []).filter(
        (item) =>
          Number.isFinite(Date.parse(item.time)) && Number.isFinite(item.temperatureCelsius),
      ).length,
    });
  });
  await check('eia-NYIS', async () => {
    const result = await request('/api/aethergrid/energy/context?region=NYIS');
    return {
      ...summarizeProvider(result, 'eia', { records: result.data?.fuelMix?.length || 0 }),
      region: 'NYIS',
    };
  });
  await check('noaa-BATN6', async () =>
    summarizeObservation(
      await request('/api/aethergrid/hydrology/gauges?gaugeId=BATN6'),
      'noaa-BATN6',
    ),
  );
  await check('transitland', async () => {
    const result = await request(
      '/api/aethergrid/transit/discovery?lat=40.758&lon=-73.9855&radius=10000&limit=20',
    );
    return summarizeProvider(result, 'transitland', { records: result.data?.feeds?.length || 0 });
  });
  await check('nyc-ferry-GTFS', async () => {
    const result = await request('/api/aethergrid/transit/realtime?cityId=new-york');
    const tripUpdates = Array.isArray(result.data?.tripUpdates)
      ? result.data.tripUpdates.length
      : 0;
    return {
      ...summarizeScheduledRealtime(result, 'gtfs-rt-registry', {
        records: tripUpdates,
        expectedDataset: 'transit-trip-updates',
        runAt: report.runAt,
        sourceTimestamp: result.data?.feedHeaderTimestamp,
        timeZone: 'America/New_York',
        serviceStartHour: 6,
        serviceEndHour: 22,
        maxSourceAgeSeconds: 300,
      }),
      messageType: result.data?.messageType || null,
    };
  });
  for (const [name, names] of [
    ['ibm', ['AETHERGRID_IBM_QUANTUM_API_KEY', 'AETHERGRID_IBM_QUANTUM_SERVICE_CRN']],
    ['dwave', ['AETHERGRID_DWAVE_API_TOKEN']],
  ]) {
    const prerequisites = Object.fromEntries(
      names.map((key) => [key, Boolean(process.env[key]?.trim())]),
    );
    report.providers[name] = {
      state: Object.values(prerequisites).every(Boolean)
        ? 'configured-not-hardware-validated'
        : 'unconfigured',
      prerequisites,
      hardwareSubmitted: false,
      hardwareExecuted: false,
    };
  }
} catch {
  report.startup = {
    verified: false,
    reason: 'canonical startup/readiness failed; raw output deliberately withheld',
  };
} finally {
  if (server.exitCode === null) {
    await new Promise((resolve) => {
      server.once('exit', resolve);
      server.kill('SIGTERM');
      const timeout = setTimeout(() => {
        server.kill('SIGKILL');
        resolve();
      }, 5000);
      timeout.unref();
    });
  }
  await mkdir('canonical-evidence', { recursive: true });
  const sanitized = sanitizeAcceptance(report);
  await writeFile('canonical-evidence/providers.json', `${JSON.stringify(sanitized, null, 2)}\n`);
  const failed =
    report.startup || Object.values(report.providers).some((item) => item.verified === false);
  console.log(
    JSON.stringify({
      commit: report.commit,
      providers: Object.fromEntries(
        Object.entries(report.providers).map(([name, item]) => [name, item.state]),
      ),
      passed: !failed,
    }),
  );
  if (failed) process.exitCode = 1;
}
