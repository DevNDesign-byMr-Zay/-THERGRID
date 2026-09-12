import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildBaselineOperatingProposal, buildPersistenceForecast } from '../src/planning.mjs';
import { deriveTwinState } from '../src/twin.mjs';

async function loadFixture() {
  const source = await readFile(new URL('../fixtures/microgrid.json', import.meta.url), 'utf8');
  return JSON.parse(source);
}

test('persistence forecast is deterministic from the current twin state', async () => {
  const twinState = deriveTwinState(await loadFixture());

  const forecast = buildPersistenceForecast(twinState, { horizonMinutes: 15 });

  assert.deepEqual(forecast, {
    schemaVersion: 1,
    method: 'persistence-v1',
    snapshotId: 'microgrid-demo-001',
    observedAt: '2026-09-12T16:00:00.000Z',
    forecastFor: '2026-09-12T16:15:00.000Z',
    horizonMinutes: 15,
    generationKw: 120,
    loadKw: 124,
  });
});

test('balanced baseline produces an advisory no-op grid adjustment', async () => {
  const twinState = deriveTwinState(await loadFixture());
  const forecast = buildPersistenceForecast(twinState);

  const proposal = buildBaselineOperatingProposal(twinState, forecast);

  assert.equal(proposal.strategy, 'balance-via-grid-v1');
  assert.equal(proposal.projectedBalanceKw, 0);
  assert.deepEqual(proposal.action, {
    kind: 'grid_interchange_target',
    adjustmentKw: 0,
    targetKw: 22,
  });
  assert.equal(proposal.advisoryOnly, true);
});

test('proposal closes a projected load increase through the grid target only', async () => {
  const twinState = deriveTwinState(await loadFixture());
  const forecast = {
    ...buildPersistenceForecast(twinState),
    loadKw: 139,
  };

  const proposal = buildBaselineOperatingProposal(twinState, forecast);

  assert.equal(proposal.projectedBalanceKw, -15);
  assert.deepEqual(proposal.action, {
    kind: 'grid_interchange_target',
    adjustmentKw: 15,
    targetKw: 37,
  });
  assert.equal(proposal.inputs.batteryKw, -18);
});

test('proposal rejects forecast evidence from another snapshot', async () => {
  const twinState = deriveTwinState(await loadFixture());
  const forecast = {
    ...buildPersistenceForecast(twinState),
    snapshotId: 'other-snapshot',
  };

  assert.throws(
    () => buildBaselineOperatingProposal(twinState, forecast),
    /forecast\.snapshotId must match twinState\.snapshotId/,
  );
});

test('forecast rejects non-positive horizons', async () => {
  const twinState = deriveTwinState(await loadFixture());

  assert.throws(
    () => buildPersistenceForecast(twinState, { horizonMinutes: 0 }),
    /horizonMinutes must be a positive integer/,
  );
});
