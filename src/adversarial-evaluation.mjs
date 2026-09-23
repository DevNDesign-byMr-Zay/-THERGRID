import { createHash } from 'node:crypto';
import { validateGridSnapshot } from './contracts.mjs';
import { createModelRoute } from './model-routing.mjs';
import {
  buildSolverEvidence,
  evaluatePromotionGate,
  fingerprintSolverEvidence,
} from './solver-evaluation.mjs';

const EVALUATION_VERSION = 3;
const DEFAULT_MAX_TELEMETRY_AGE_MS = 5 * 60 * 1000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${name} must be an object`);
  return value;
}
function telemetryAgeMs(snapshot, now = Date.now()) {
  const observed = Date.parse(snapshot?.observedAt);
  if (!Number.isFinite(observed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - observed);
}

export const ADVERSARIAL_FIXTURES = Object.freeze([
  'stale-telemetry',
  'malformed-units',
  'impossible-asset-state',
  'missing-model-capability',
  'solver-timeout',
  'infeasible-constraints',
  'fallback-activation',
  'seed-drift',
]);

export function buildAdversarialCase(name, snapshot, { now = Date.now() } = {}) {
  if (!ADVERSARIAL_FIXTURES.includes(name))
    throw new TypeError(`unsupported adversarial fixture: ${name}`);
  const candidate = clone(object(snapshot, 'snapshot'));
  let metadata = {};
  switch (name) {
    case 'stale-telemetry':
      candidate.observedAt = new Date(now - DEFAULT_MAX_TELEMETRY_AGE_MS - 1).toISOString();
      metadata = { maxAgeMs: DEFAULT_MAX_TELEMETRY_AGE_MS, now };
      break;
    case 'malformed-units':
      candidate.assets[0].powerKw = '40kW';
      break;
    case 'impossible-asset-state': {
      const battery = candidate.assets.find((asset) => asset.kind === 'battery');
      if (!battery) throw new TypeError('fixture requires a battery asset');
      battery.stateOfChargeKwh = battery.capacityKwh + 1;
      break;
    }
    case 'missing-model-capability':
      metadata = { capability: 'actuate.grid' };
      break;
    case 'solver-timeout':
      metadata = { timeout: true, feasible: false, runtimeMs: 30000 };
      break;
    case 'infeasible-constraints':
      metadata = { timeout: false, feasible: false, runtimeMs: 2 };
      break;
    case 'fallback-activation':
      metadata = {
        fallback: 'classical-reference-v1',
        fallbackUsed: true,
        primaryStatus: 'unavailable',
      };
      break;
    case 'seed-drift':
      metadata = { seed: 7, alternateSeed: 8 };
      break;
  }
  return Object.freeze({
    version: EVALUATION_VERSION,
    name,
    fingerprint: fingerprint(candidate),
    snapshot: candidate,
    metadata: Object.freeze(metadata),
  });
}

function evaluateSolverFixture(testCase) {
  const metadata = testCase.metadata;
  const evidence = buildSolverEvidence({
    experimentId: `adversarial-${testCase.name}`,
    inputSnapshotId: testCase.snapshot.snapshotId,
    candidate: { model: 'test-candidate', solver: 'test-solver', version: 'v1' },
    constraints: { fixture: testCase.name },
    seed: metadata.seed ?? 7,
    objective: 1,
    feasible: metadata.feasible ?? true,
    runtimeMs: metadata.runtimeMs ?? 2,
    timeout: metadata.timeout ?? false,
    fallback: metadata.fallback ?? null,
    provenance: [testCase.fingerprint, `fixture:${testCase.name}`],
  });
  const promotion = evaluatePromotionGate({
    evidence,
    validation: { simulationPassed: evidence.feasible, receiptValid: true, provenanceValid: true },
  });
  return {
    accepted: promotion.status === 'eligible',
    reason: promotion.reason,
    evidence,
    promotion,
  };
}

export function evaluateAdversarialCase(testCase, { now = Date.now() } = {}) {
  const value = object(testCase, 'testCase');
  if (!value.snapshot || !value.name)
    throw new TypeError('testCase must contain name and snapshot');
  if (!ADVERSARIAL_FIXTURES.includes(value.name))
    throw new TypeError(`unsupported adversarial fixture: ${value.name}`);
  let accepted = false;
  let reason = 'unknown';
  let details = {};
  try {
    switch (value.name) {
      case 'stale-telemetry': {
        const ageMs = telemetryAgeMs(value.snapshot, now);
        accepted = ageMs <= (value.metadata.maxAgeMs ?? DEFAULT_MAX_TELEMETRY_AGE_MS);
        reason = accepted
          ? 'telemetry is within freshness policy'
          : 'telemetry exceeds freshness policy';
        details = { ageMs, maxAgeMs: value.metadata.maxAgeMs ?? DEFAULT_MAX_TELEMETRY_AGE_MS };
        break;
      }
      case 'malformed-units':
      case 'impossible-asset-state':
        validateGridSnapshot(value.snapshot);
        accepted = true;
        reason = 'input accepted';
        break;
      case 'missing-model-capability': {
        const route = createModelRoute();
        try {
          route.resolve(value.metadata.capability);
          accepted = true;
          reason = 'capability unexpectedly resolved';
        } catch (error) {
          accepted = false;
          reason = error instanceof Error ? error.message : String(error);
        }
        break;
      }
      case 'solver-timeout':
      case 'infeasible-constraints': {
        const result = evaluateSolverFixture(value);
        accepted = result.accepted;
        reason = result.reason;
        details = { promotion: result.promotion };
        break;
      }
      case 'fallback-activation':
        accepted = value.metadata.fallbackUsed === true && Boolean(value.metadata.fallback);
        reason = accepted ? 'fallback identity explicitly recorded' : 'fallback identity missing';
        break;
      case 'seed-drift': {
        const first = buildSolverEvidence({
          experimentId: 'adversarial-seed-drift',
          inputSnapshotId: value.snapshot.snapshotId,
          candidate: { model: 'test-candidate', solver: 'test-solver', version: 'v1' },
          seed: value.metadata.seed,
          objective: 1,
          feasible: true,
          runtimeMs: 1,
          provenance: ['seed-test', 'fixture:seed-drift'],
        });
        const second = buildSolverEvidence({
          experimentId: first.experimentId,
          inputSnapshotId: first.inputSnapshotId,
          candidate: first.candidate,
          seed: value.metadata.alternateSeed,
          objective: first.objective,
          feasible: first.feasible,
          runtimeMs: first.runtimeMs,
          provenance: first.provenance,
        });
        const firstFingerprint = fingerprintSolverEvidence(first);
        const secondFingerprint = fingerprintSolverEvidence(second);
        accepted = firstFingerprint === secondFingerprint;
        reason = accepted
          ? 'seed drift was not captured by evidence fingerprint'
          : 'seed drift produces distinct evidence fingerprints';
        details = { firstFingerprint, secondFingerprint };
        break;
      }
    }
  } catch (error) {
    accepted = false;
    reason = error instanceof Error ? error.message : String(error);
  }
  const expectedRejection = value.name !== 'fallback-activation';
  return Object.freeze({
    version: EVALUATION_VERSION,
    fixture: value.name,
    accepted,
    expectedRejection,
    safe: expectedRejection ? !accepted : accepted,
    reason,
    fingerprint: value.fingerprint,
    details,
  });
}

export { EVALUATION_VERSION };
