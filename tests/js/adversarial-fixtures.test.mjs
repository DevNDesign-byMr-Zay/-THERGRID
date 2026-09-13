import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateGridSnapshot } from '../../src/contracts.mjs';
import {
  buildAdversarialFixture,
  fingerprintAdversarialFixture,
  listAdversarialFixtureCases,
} from '../../src/adversarial-fixtures.mjs';

async function loadFixture() {
  return JSON.parse(await readFile(new URL('../../fixtures/microgrid.json', import.meta.url), 'utf8'));
}

test('catalog exposes the complete adversarial evaluation matrix', () => {
  assert.deepEqual(listAdversarialFixtureCases(), [
    'stale-telemetry',
    'malformed-units',
    'impossible-asset-state',
    'missing-model-capability',
    'solver-timeout',
    'infeasible-constraints',
    'fallback-activation',
    'seed-drift',
  ]);
});

test('invalid physical fixtures fail the authoritative snapshot contract', async () => {
  const base = await loadFixture();
  for (const name of ['malformed-units', 'impossible-asset-state']) {
    const fixture = buildAdversarialFixture(base, name);
    assert.throws(() => validateGridSnapshot(fixture.snapshot));
    assert.equal(fixture.mutation.expectedOutcome, 'reject');
  }
});

test('adversarial fixture identity is deterministic and mutation metadata is explicit', async () => {
  const base = await loadFixture();
  const first = buildAdversarialFixture(base, 'solver-timeout');
  const second = buildAdversarialFixture(base, 'solver-timeout');

  assert.deepEqual(first, second);
  assert.equal(fingerprintAdversarialFixture(first), fingerprintAdversarialFixture(second));
  assert.equal(first.mutation.timeout, true);
  assert.equal(first.mutation.expectedOutcome, 'reject');
});

test('fallback and missing-capability fixtures remain non-authoritative', async () => {
  const base = await loadFixture();
  for (const name of ['missing-model-capability', 'fallback-activation']) {
    const fixture = buildAdversarialFixture(base, name);
    assert.equal(fixture.mutation.expectedOutcome, 'fallback');
    assert.equal(fixture.mutation.kind === 'fallback-activation' || fixture.mutation.model === null, true);
  }
});

test('seed drift is represented as a reproducibility failure', async () => {
  const base = await loadFixture();
  const fixture = buildAdversarialFixture(base, 'seed-drift');
  assert.deepEqual(fixture.mutation.seed, [0, 1]);
  assert.equal(fixture.mutation.expectedOutcome, 'reject');
});
