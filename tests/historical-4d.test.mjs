import test from 'node:test';
import assert from 'node:assert/strict';
import { createCityEnvironmentRuntime } from '../apps/aethergrid-console/city-environment-runtime.mjs';

test('historical 4D runtime returns queryable time windows, valid-time boundaries, and explicit unavailable states', async () => {
  const envRuntime = createCityEnvironmentRuntime();

  // Valid historical request within stored/valid time window
  const now = new Date();
  const startTime = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
  const endTime = new Date(now.getTime() - 1 * 3600 * 1000).toISOString();

  const history = await envRuntime.historical({
    lat: 40.7128,
    lon: -74.006,
    startTime,
    endTime,
  });

  assert.equal(history.schemaVersion, 2);
  assert.equal(history.available, true);
  assert.ok(Array.isArray(history.observations));
  assert.ok(history.receipt);
  assert.equal(history.receipt.provider, 'Open-Meteo Historical / Persisted Observations');

  // Unavailable historical request (far in the past, beyond valid boundary)
  const unavailableHistory = await envRuntime.historical({
    lat: 40.7128,
    lon: -74.006,
    startTime: '1900-01-01T00:00:00Z',
    endTime: '1900-01-01T01:00:00Z',
  });

  assert.equal(unavailableHistory.available, false);
  assert.ok(
    unavailableHistory.reason.includes('unsupported') ||
      unavailableHistory.reason.includes('No historical'),
  );
  assert.equal(unavailableHistory.observations.length, 0);
});
