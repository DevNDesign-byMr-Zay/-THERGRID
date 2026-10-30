import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

async function helpers() {
  const context = {};
  runInNewContext(
    await readFile(
      new URL('../apps/aethergrid-console/environment-helpers.js', import.meta.url),
      'utf8',
    ),
    context,
  );
  return context.AETHERGRID_ENVIRONMENT_HELPERS;
}

test('environment hour preserves local provider time without timezone conversion', async () => {
  const { environmentHour } = await helpers();
  assert.equal(environmentHour({ current: { time: '2026-10-29T23:30:00-04:00' } }), 23.5);
  assert.equal(environmentHour({ current: { time: '2026-10-29T00:00' } }), 0);
  assert.equal(environmentHour(null), null);
  assert.equal(environmentHour({ current: { time: 'unavailable' } }), null);
});

test('weather identity preserves WMO categories and nested provider precedence', async () => {
  const { weatherPhenomenon } = await helpers();
  for (const [codes, label] of [
    [[0], 'Clear'],
    [[1, 2, 3], 'Cloudy'],
    [[45, 48], 'Fog'],
    [[71, 73, 75, 77, 85, 86], 'Snow'],
    [[95, 96, 99], 'Thunderstorm'],
    [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], 'Rain'],
    [[4, 100], 'Mixed'],
  ]) {
    for (const weatherCode of codes) assert.equal(weatherPhenomenon({ weatherCode }), label);
  }
  assert.equal(weatherPhenomenon({ current: { weatherCode: 71 }, weatherCode: 61 }), 'Snow');
  assert.equal(weatherPhenomenon(null), 'Clear');
});
