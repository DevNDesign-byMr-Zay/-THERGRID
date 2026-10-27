import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createProviderBootstrap } from '../apps/aethergrid-console/providers/bootstrap.mjs';

test('provider bootstrap constructs adapters without external requests', () => {
  let calls = 0;
  const boot = createProviderBootstrap({
    env: {},
    fetchImpl: async () => {
      calls += 1;
      throw new Error('unexpected network request');
    },
  });
  for (const name of [
    'tomorrowWeatherProvider',
    'nwsAlertsProvider',
    'eiaProvider',
    'noaaNwpsProvider',
    'transitlandProvider',
    'dwaveProvider',
  ]) {
    assert.equal(typeof boot[name].request, 'function', name);
  }
  assert.equal(typeof boot.transitRegistry.adapter.request, 'function');
  assert.equal(calls, 0);
  assert.equal(boot.transitFeedConfig.metadata.enabledFeedCount, 0);
  const statuses = boot.providerRegistry.health.getAllStatuses();
  assert.equal(statuses['gtfs-rt-registry'].status, 'unconfigured');
  assert.equal(statuses.transitland.status, 'unconfigured');
  assert.equal(statuses.dwave.hardwareEnabled, false);
  assert.equal(statuses['ibm-quantum'].hardwareEnabled, false);
});

test('bootstrap pipeline rejects unapproved destinations before fetch', async () => {
  let calls = 0;
  const boot = createProviderBootstrap({
    env: {},
    fetchImpl: async () => {
      calls += 1;
      return { ok: true };
    },
  });
  await assert.rejects(
    boot.createPipelineFetch('nws')('http://127.0.0.1/private'),
  );
  assert.equal(calls, 0);
  assert.equal(boot.providerRegistry.health.getProviderStatus('nws').requestCount, 0);
});

test('bootstrap pipeline forwards request and response identity and records success', async () => {
  const response = { ok: true, status: 200 };
  const requests = [];
  const boot = createProviderBootstrap({
    env: {},
    fetchImpl: async (...args) => {
      requests.push(args);
      return response;
    },
  });
  const url = new URL('https://api.weather.gov/alerts/active');
  const options = { headers: { accept: 'application/json' } };
  assert.equal(await boot.createPipelineFetch('nws')(url, options), response);
  assert.deepEqual(requests, [[url, options]]);
  const status = boot.providerRegistry.health.getProviderStatus('nws');
  assert.equal(status.requestCount, 1);
  assert.equal(status.successCount, 1);
  assert.equal(status.failureCount, 0);
  assert.equal(status.status, 'ready');
  assert.ok(Number.isFinite(status.lastLiveSuccessAt));
});

test('bootstrap pipeline preserves HTTP failures and records unavailable health', async () => {
  const response = { ok: false, status: 503 };
  const boot = createProviderBootstrap({
    env: {},
    fetchImpl: async () => response,
  });
  const result = await boot.createPipelineFetch('nws')('https://api.weather.gov/alerts');
  assert.equal(result, response);
  const status = boot.providerRegistry.health.getProviderStatus('nws');
  assert.equal(status.requestCount, 1);
  assert.equal(status.failureCount, 1);
  assert.equal(status.successCount, 0);
  assert.equal(status.status, 'unavailable');
  assert.equal(status.lastLiveSuccessAt, null);
});

test('bootstrap pipeline preserves thrown errors and records failure once', async () => {
  const failure = new Error('fixture upstream disconnected');
  const boot = createProviderBootstrap({
    env: {},
    fetchImpl: async () => {
      throw failure;
    },
  });
  await assert.rejects(
    boot.createPipelineFetch('nws')('https://api.weather.gov/alerts'),
    (error) => error === failure,
  );
  const status = boot.providerRegistry.health.getProviderStatus('nws');
  assert.equal(status.requestCount, 1);
  assert.equal(status.failureCount, 1);
  assert.equal(status.status, 'unavailable');
});

test('bootstrap registers enabled transit origins without claiming live success', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'aethergrid-bootstrap-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'feeds.json');
  await writeFile(
    path,
    JSON.stringify({
      schemaVersion: 1,
      feeds: [
        {
          id: 'fixture-feed',
          cityId: 'fixture-city',
          agencyName: 'Fixture Transit',
          url: 'https://transit.example.test/vehicles.pb',
        },
      ],
    }),
  );
  const boot = createProviderBootstrap({ env: { AETHERGRID_GTFS_FEEDS_FILE: path } });
  assert.equal(boot.transitFeedConfig.metadata.enabledFeedCount, 1);
  assert.equal(
    boot.transitFeedConfig.feeds['fixture-city'].feedUrl,
    'https://transit.example.test/vehicles.pb',
  );
  assert.doesNotThrow(() =>
    boot.providerRegistry.urlPolicy.validateUrl('https://transit.example.test/vehicles.pb'),
  );
  const status = boot.providerRegistry.health.getProviderStatus('gtfs-rt-registry');
  assert.equal(status.status, 'configured');
  assert.equal(status.requestCount, 0);
  assert.equal(status.lastLiveSuccessAt, null);
});

test('bootstrap instances do not share provider health', async () => {
  const first = createProviderBootstrap({
    env: {},
    fetchImpl: async () => ({ ok: true }),
  });
  const second = createProviderBootstrap({ env: {} });
  await first.createPipelineFetch('nws')('https://api.weather.gov/alerts');
  assert.equal(first.providerRegistry.health.getProviderStatus('nws').requestCount, 1);
  assert.equal(second.providerRegistry.health.getProviderStatus('nws').requestCount, 0);
});
