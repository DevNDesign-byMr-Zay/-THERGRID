import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVERSARIAL_FIXTURES,
  buildAdversarialCase,
  evaluateAdversarialCase,
} from '../src/adversarial-evaluation.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'adversarial-v1',
  observedAt: '2026-09-13T00:00:00.000Z',
  assets: [
    { id: 'solar-1', kind: 'solar', powerKw: 40, capacityKw: 50 },
    {
      id: 'battery-1',
      kind: 'battery',
      powerKw: 0,
      capacityKw: 25,
      capacityKwh: 100,
      stateOfChargeKwh: 60,
    },
    { id: 'load-1', kind: 'load', powerKw: 45, flexible: true },
    { id: 'grid-1', kind: 'grid_interconnect', powerKw: -15, importLimitKw: 80, exportLimitKw: 40 },
  ],
  topology: {
    nodes: ['node-a'],
    connections: [
      { assetId: 'solar-1', nodeId: 'node-a' },
      { assetId: 'battery-1', nodeId: 'node-a' },
      { assetId: 'load-1', nodeId: 'node-a' },
      { assetId: 'grid-1', nodeId: 'node-a' },
    ],
  },
};

test('builds every adversarial fixture deterministically', () => {
  for (const name of ADVERSARIAL_FIXTURES) {
    const first = buildAdversarialCase(name, snapshot, {
      now: Date.parse('2026-09-13T01:00:00.000Z'),
    });
    const second = buildAdversarialCase(name, snapshot, {
      now: Date.parse('2026-09-13T01:00:00.000Z'),
    });
    assert.deepEqual(first, second);
  }
});

test('rejects stale telemetry under the freshness policy', () => {
  const now = Date.parse('2026-09-13T01:00:00.000Z');
  const result = evaluateAdversarialCase(
    buildAdversarialCase('stale-telemetry', snapshot, { now }),
    { now },
  );
  assert.equal(result.safe, true);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /freshness policy/);
});

test('rejects malformed units and impossible battery state through the input contract', () => {
  for (const name of ['malformed-units', 'impossible-asset-state']) {
    const result = evaluateAdversarialCase(buildAdversarialCase(name, snapshot));
    assert.equal(result.accepted, false);
    assert.equal(result.safe, true);
  }
});

test('rejects missing model capabilities rather than silently routing them', () => {
  const result = evaluateAdversarialCase(
    buildAdversarialCase('missing-model-capability', snapshot),
  );
  assert.equal(result.accepted, false);
  assert.equal(result.safe, true);
  assert.match(result.reason, /unsupported capability/);
});

test('solver timeout and infeasibility fail promotion gates', () => {
  for (const name of ['solver-timeout', 'infeasible-constraints']) {
    const result = evaluateAdversarialCase(buildAdversarialCase(name, snapshot));
    assert.equal(result.accepted, false);
    assert.equal(result.safe, true);
    assert.equal(result.details.promotion.status, 'rejected');
  }
});

test('fallback activation is explicit and safe when identity is recorded', () => {
  const result = evaluateAdversarialCase(buildAdversarialCase('fallback-activation', snapshot));
  assert.equal(result.accepted, true);
  assert.equal(result.safe, true);
});

test('seed drift changes evidence fingerprints', () => {
  const result = evaluateAdversarialCase(buildAdversarialCase('seed-drift', snapshot));
  assert.equal(result.accepted, false);
  assert.equal(result.safe, true);
  assert.notEqual(result.details.firstFingerprint, result.details.secondFingerprint);
});
