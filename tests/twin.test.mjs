import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateGridSnapshot } from '../src/contracts.mjs';
import { deriveTwinState } from '../src/twin.mjs';

async function loadFixture() {
  const content = await readFile(new URL('../fixtures/microgrid.json', import.meta.url), 'utf8');
  return JSON.parse(content);
}

test('synthetic microgrid produces deterministic balanced twin state', async () => {
  const fixture = await loadFixture();

  const first = deriveTwinState(fixture);
  const second = deriveTwinState(fixture);

  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    schemaVersion: 1,
    snapshotId: 'microgrid-demo-001',
    observedAt: '2026-09-12T16:00:00.000Z',
    topology: {
      nodeCount: 1,
      connectionCount: 6,
    },
    totals: {
      generationKw: 120,
      loadKw: 124,
      batteryKw: -18,
      gridKw: 22,
      balanceKw: 0,
      renewableSharePercent: 96.774194,
    },
    storage: [
      {
        assetId: 'battery-1',
        capacityKwh: 240,
        stateOfChargeKwh: 144,
        stateOfChargePercent: 60,
        powerKw: -18,
        mode: 'charging',
      },
    ],
    balanced: true,
  });
});

test('validation normalizes timestamp without mutating source data', async () => {
  const fixture = await loadFixture();
  fixture.observedAt = '2026-09-12T12:00:00-04:00';

  const validated = validateGridSnapshot(fixture);

  assert.equal(validated.observedAt, '2026-09-12T16:00:00.000Z');
  assert.equal(fixture.observedAt, '2026-09-12T12:00:00-04:00');
});

test('validation rejects duplicate asset identities', async () => {
  const fixture = await loadFixture();
  fixture.assets[1].id = fixture.assets[0].id;

  assert.throws(() => validateGridSnapshot(fixture), /duplicate asset id/);
});

test('validation rejects topology references to unknown assets', async () => {
  const fixture = await loadFixture();
  fixture.topology.connections[0].assetId = 'missing-asset';

  assert.throws(() => validateGridSnapshot(fixture), /unknown asset/);
});

test('validation rejects battery state of charge outside capacity', async () => {
  const fixture = await loadFixture();
  const battery = fixture.assets.find((asset) => asset.kind === 'battery');
  battery.stateOfChargeKwh = battery.capacityKwh + 1;

  assert.throws(() => validateGridSnapshot(fixture), /outside battery capacity/);
});
