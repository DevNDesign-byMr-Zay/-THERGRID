import { createHash } from 'node:crypto';

const ADVERSARIAL_FIXTURE_VERSION = 1;

const CASES = Object.freeze([
  'stale-telemetry',
  'malformed-units',
  'impossible-asset-state',
  'missing-model-capability',
  'solver-timeout',
  'infeasible-constraints',
  'fallback-activation',
  'seed-drift',
]);

function clone(value) {
  return structuredClone(value);
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function requireFixtureCase(value) {
  if (!CASES.includes(value)) throw new TypeError(`unsupported adversarial fixture: ${value}`);
  return value;
}

export function listAdversarialFixtureCases() {
  return [...CASES];
}

export function buildAdversarialFixture(baseSnapshot, fixtureCase) {
  const name = requireFixtureCase(fixtureCase);
  const snapshot = clone(baseSnapshot);
  const mutation = { kind: name, expectedOutcome: 'reject' };

  switch (name) {
    case 'stale-telemetry':
      snapshot.observedAt = new Date(Date.parse(snapshot.observedAt) - 24 * 60 * 60 * 1000).toISOString();
      mutation.expectedOutcome = 'reject';
      mutation.reason = 'telemetry is outside the freshness boundary';
      break;
    case 'malformed-units':
      snapshot.assets[0].powerKw = '120 kW';
      mutation.reason = 'power values must remain numeric and unit-normalized';
      break;
    case 'impossible-asset-state': {
      const battery = snapshot.assets.find((asset) => asset.kind === 'battery');
      if (!battery) throw new TypeError('base snapshot must contain a battery for this fixture');
      battery.stateOfChargeKwh = battery.capacityKwh + 1;
      mutation.reason = 'battery state of charge exceeds capacity';
      break;
    }
    case 'missing-model-capability':
      mutation.expectedOutcome = 'fallback';
      mutation.model = null;
      mutation.reason = 'requested intelligence capability is unavailable';
      break;
    case 'solver-timeout':
      mutation.expectedOutcome = 'reject';
      mutation.timeout = true;
      mutation.reason = 'solver exceeded its allowed execution window';
      break;
    case 'infeasible-constraints':
      mutation.expectedOutcome = 'reject';
      mutation.constraints = { importLimitKw: 0, requiredGridKw: 1000 };
      mutation.reason = 'candidate cannot satisfy declared operating constraints';
      break;
    case 'fallback-activation':
      mutation.expectedOutcome = 'fallback';
      mutation.fallback = 'classical-summary-v1';
      mutation.reason = 'primary model unavailable; deterministic fallback activated';
      break;
    case 'seed-drift':
      mutation.expectedOutcome = 'reject';
      mutation.seed = [0, 1];
      mutation.reason = 'reproducibility seed changed between equivalent evaluations';
      break;
  }

  const fixture = Object.freeze({
    fixtureVersion: ADVERSARIAL_FIXTURE_VERSION,
    case: name,
    snapshot,
    mutation: Object.freeze(mutation),
  });
  return Object.freeze({ ...fixture, fixtureId: `adv-${fingerprint(fixture).slice(0, 16)}` });
}

export function fingerprintAdversarialFixture(fixture) {
  if (!fixture || typeof fixture !== 'object') throw new TypeError('fixture must be an object');
  return fingerprint({
    fixtureVersion: fixture.fixtureVersion,
    case: fixture.case,
    snapshot: fixture.snapshot,
    mutation: fixture.mutation,
  });
}

export { ADVERSARIAL_FIXTURE_VERSION };
