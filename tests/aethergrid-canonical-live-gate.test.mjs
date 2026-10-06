import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  summarizeAgent,
  summarizeProvider,
  summarizeObservation,
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
    readFileSync(
      'docs/acceptance/aethergrid-command-center/verified-gtfs-feeds.json',
      'utf8',
    ),
  );

  assert.match(
    smoke,
    /transit\/discovery\?lat=40\.758&lon=-73\.9855&radius=10000&limit=20/u,
  );
  assert.match(smoke, /transit\/realtime\?cityId=new-york/u);
  assert.match(smoke, /transit-trip-updates/u);

  assert.equal(feedConfig.feeds.length, 1);
  assert.equal(feedConfig.feeds[0].messageType, 'trip-updates');
  assert.match(feedConfig.feeds[0].url, /\/tripupdate$/u);
  assert.doesNotMatch(feedConfig.feeds[0].url, /vehicleposition/u);
});
