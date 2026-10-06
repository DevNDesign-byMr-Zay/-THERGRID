import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  summarizeAgent,
  summarizeProvider,
  summarizeObservation,
  summarizeScheduledRealtime,
  summarizeQuantumDiscovery,
  sanitizeAcceptance,
} from '../scripts/lib/canonical-acceptance.mjs';

const runtime = {
  provider: 'openai-compatible',
  model: 'test-model',
  fallbackUsed: false,
  error: null,
};
const agent = { reply: 'READY', receipt: 'receipt', runtime };

test('canonical acceptance refuses local, empty or fallback agent success', () => {
  assert.equal(summarizeAgent(agent, 'AUREN').verified, true);
  for (const value of [
    { ...agent, runtime: { ...runtime, provider: 'local' } },
    { ...agent, runtime: { ...runtime, fallbackUsed: true } },
    { ...agent, reply: '' },
    { ...agent, runtime: { ...runtime, error: 'upstream failed' } },
  ])
    assert.equal(summarizeAgent(value, 'AUREN').verified, false);
});

test('TEAM acceptance requires each distinct specialist and real synthesis', () => {
  const contributions = ['VÆLON', 'AUREN', 'SOLVÆR'].map((name) => ({ ...agent, agent: name }));
  const team = { ...agent, contributions };
  assert.equal(summarizeAgent(team, 'TEAM').verified, true);
  assert.equal(
    summarizeAgent({ ...team, contributions: contributions.slice(0, 2) }, 'TEAM').verified,
    false,
  );
  assert.equal(
    summarizeAgent(
      { ...team, contributions: [contributions[0], contributions[0], contributions[2]] },
      'TEAM',
    ).verified,
    false,
  );
  assert.equal(
    summarizeAgent(
      {
        ...team,
        contributions: contributions.map((item, i) =>
          i ? item : { ...item, runtime: { ...runtime, fallbackUsed: true } },
        ),
      },
      'TEAM',
    ).verified,
    false,
  );
});

test('provider acceptance rejects stale, empty, wrong-provider and fallback receipts', () => {
  const payload = {
    receipt: {
      provider: 'eia',
      live: true,
      stale: false,
      fallback: false,
      retrievedAt: '2026-10-06T00:00:00Z',
    },
  };
  assert.equal(summarizeProvider(payload, 'eia', { records: 2 }).verified, true);
  assert.equal(summarizeProvider(payload, 'eia', { records: 0 }).verified, false);
  assert.equal(summarizeProvider(payload, 'tomorrow-io', { records: 2 }).verified, false);
  for (const change of [{ live: false }, { fallback: true }, { stale: true }]) {
    assert.equal(
      summarizeProvider({ receipt: { ...payload.receipt, ...change } }, 'eia', { records: 2 })
        .verified,
      false,
    );
  }
});

test('evidence sanitation removes private keys and public-client Cesium token values', () => {
  const secret = 'unique-secret-for-regression';
  const result = sanitizeAcceptance(
    { error: `failed ${secret}`, nested: { token: secret }, encoded: encodeURIComponent(secret) },
    { AETHERGRID_CESIUM_ION_TOKEN: secret },
  );
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
});

test('live observations reject NOAA metadata-only and empty Tomorrow data', () => {
  for (const [kind, provider, data] of [
    [
      'tomorrow-current',
      'tomorrow-io',
      { observedAt: '2026-10-06T00:00:00Z', temperatureCelsius: 19, status: 'Tomorrow.io Live' },
    ],
    [
      'noaa-BATN6',
      'noaa-nwps',
      {
        observedAt: '2026-10-06T00:00:00Z',
        gaugeId: 'BATN6',
        observedStageFeet: 2,
        status: 'NOAA NWPS Live',
      },
    ],
  ]) {
    const receipt = { live: true, provider };
    assert.equal(summarizeObservation({ receipt, data }, kind).verified, true);
    for (const invalid of [
      {},
      { ...data, observedAt: null },
      { ...data, status: 'NOAA NWPS Partial (Metadata Only)' },
    ])
      assert.equal(summarizeObservation({ receipt, data: invalid }, kind).verified, false);
  }
});

test('canonical transit acceptance uses geo feed discovery and documented NYC Ferry trip updates', () => {
  const smoke = readFileSync('scripts/aethergrid-canonical-provider-smoke.mjs', 'utf8');
  const feedConfig = JSON.parse(
    readFileSync('docs/acceptance/aethergrid-command-center/verified-gtfs-feeds.json', 'utf8'),
  );

  assert.match(smoke, /transit\/discovery\?lat=40\.758&lon=-73\.9855&radius=10000&limit=20/u);
  assert.match(smoke, /transit\/realtime\?cityId=new-york/u);
  assert.match(smoke, /transit-trip-updates/u);

  assert.equal(feedConfig.feeds.length, 1);
  assert.equal(feedConfig.feeds[0].messageType, 'trip-updates');
  assert.match(feedConfig.feeds[0].url, /\/tripupdate$/u);
  assert.doesNotMatch(feedConfig.feeds[0].url, /vehicleposition/u);
});

test('scheduled realtime acceptance requires records during service hours but permits a fresh empty feed after hours', () => {
  const feedHeaderTimestamp = Date.parse('2026-10-06T02:54:00Z') / 1000;
  const payload = {
    receipt: {
      provider: 'gtfs-rt-registry',
      dataset: 'transit-trip-updates',
      live: true,
      fallback: false,
      stale: false,
      retrievedAt: '2026-10-06T02:54:12Z',
    },
    data: {
      stale: false,
      feedHeaderTimestamp,
    },
  };

  const afterHours = summarizeScheduledRealtime(payload, 'gtfs-rt-registry', {
    records: 0,
    expectedDataset: 'transit-trip-updates',
    runAt: '2026-10-06T02:54:12Z',
    sourceTimestamp: feedHeaderTimestamp,
    timeZone: 'America/New_York',
    serviceStartHour: 6,
    serviceEndHour: 22,
  });
  assert.equal(afterHours.serviceWindow.withinServiceHours, false);
  assert.equal(afterHours.sourceFresh, true);
  assert.equal(afterHours.verified, true);
  assert.equal(afterHours.acceptanceState, 'live-empty-outside-service-hours');

  const duringService = summarizeScheduledRealtime(payload, 'gtfs-rt-registry', {
    records: 0,
    expectedDataset: 'transit-trip-updates',
    runAt: '2026-10-05T18:00:12Z',
    sourceTimestamp: Date.parse('2026-10-05T18:00:00Z') / 1000,
    timeZone: 'America/New_York',
    serviceStartHour: 6,
    serviceEndHour: 22,
  });
  assert.equal(duringService.serviceWindow.withinServiceHours, true);
  assert.equal(duringService.verified, false);

  const staleAfterHours = summarizeScheduledRealtime(payload, 'gtfs-rt-registry', {
    records: 0,
    expectedDataset: 'transit-trip-updates',
    runAt: '2026-10-06T02:54:12Z',
    sourceTimestamp: Date.parse('2026-10-06T02:40:00Z') / 1000,
    timeZone: 'America/New_York',
    serviceStartHour: 6,
    serviceEndHour: 22,
  });
  assert.equal(staleAfterHours.sourceFresh, false);
  assert.equal(staleAfterHours.verified, false);
});


test('IBM canonical discovery requires authenticated configured runtime and at least one backend without submitting hardware', () => {
  const summary = {
    apiVersion: '2026-04-15',
    credentialsExposed: false,
    providers: {
      ibm: {
        configured: true,
        apiKeyPresent: true,
        serviceCrnPresent: true,
      },
    },
  };

  const accepted = summarizeQuantumDiscovery(
    {
      provider: 'ibm-quantum',
      backends: [
        { name: 'ibm_test_qpu', simulator: false },
        { name: 'ibm_test_sim', simulator: true },
      ],
    },
    summary,
  );
  assert.equal(accepted.verified, true);
  assert.equal(accepted.acceptanceState, 'live-authenticated-discovery-verified');
  assert.equal(accepted.backendCount, 2);
  assert.equal(accepted.hardwareBackendCount, 1);
  assert.equal(accepted.simulatorCount, 1);
  assert.equal(accepted.hardwareSubmitted, false);
  assert.equal(accepted.hardwareExecuted, false);

  for (const [result, runtime] of [
    [{ provider: 'ibm-quantum', backends: [] }, summary],
    [{ provider: 'local-simulator', backends: [{ name: 'local' }] }, summary],
    [
      { provider: 'ibm-quantum', backends: [{ name: 'ibm_test_qpu' }] },
      {
        ...summary,
        providers: {
          ibm: {
            configured: false,
            apiKeyPresent: true,
            serviceCrnPresent: false,
          },
        },
      },
    ],
    [
      { provider: 'ibm-quantum', backends: [{ name: 'ibm_test_qpu' }] },
      { ...summary, credentialsExposed: true },
    ],
  ]) {
    assert.equal(summarizeQuantumDiscovery(result, runtime).verified, false);
  }
});

test('canonical IBM acceptance performs discovery only and contains no hardware submission call', () => {
  const smoke = readFileSync('scripts/aethergrid-canonical-provider-smoke.mjs', 'utf8');
  assert.match(smoke, /AETHERGRID_QUANTUM_PROVIDER: 'ibm-quantum'/u);
  assert.match(smoke, /runtime\.listBackends\(\)/u);
  assert.match(smoke, /summarizeQuantumDiscovery/u);
  assert.doesNotMatch(smoke, /submitSampler|submitEstimator|POST \/api\/aethergrid\/quantum\/jobs/u);
});
