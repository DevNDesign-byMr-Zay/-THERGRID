import { createHash } from 'node:crypto';

const EVALUATION_VERSION = 3;

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${name} must be an object`);
  return value;
}
function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}
function text(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

export function buildSolverEvidence({
  experimentId,
  candidate,
  inputSnapshotId,
  constraints = null,
  seed = null,
  objective,
  feasible,
  runtimeMs,
  timeout = false,
  fallback = null,
  provenance = [],
} = {}) {
  const c = object(candidate, 'candidate');
  return Object.freeze({
    evaluationVersion: EVALUATION_VERSION,
    experimentId: text(experimentId, 'experimentId'),
    inputSnapshotId: text(inputSnapshotId, 'inputSnapshotId'),
    candidate: {
      model: text(c.model ?? 'unknown', 'candidate.model'),
      solver: text(c.solver ?? 'unknown', 'candidate.solver'),
      version: text(c.version ?? 'unversioned', 'candidate.version'),
    },
    constraints,
    seed,
    objective: finite(objective, 'objective'),
    feasible: Boolean(feasible),
    runtimeMs: finite(runtimeMs, 'runtimeMs'),
    timeout: Boolean(timeout),
    fallback: fallback == null ? null : text(fallback, 'fallback'),
    provenance: Array.isArray(provenance)
      ? provenance.map((ref) => text(ref, 'provenance reference'))
      : [],
  });
}

export function fingerprintSolverEvidence(evidence) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(object(evidence, 'evidence'))), 'utf8')
    .digest('hex');
}

export function compareSolverEvidence(evidences = []) {
  if (!Array.isArray(evidences)) throw new TypeError('evidences must be an array');
  return evidences.map((evidence) => {
    const value = object(evidence, 'evidence');
    return Object.freeze({
      fingerprint: fingerprintSolverEvidence(value),
      candidate: value.candidate,
      feasible: value.feasible,
      objective: value.objective,
      runtimeMs: value.runtimeMs,
      timeout: value.timeout,
      fallback: value.fallback,
      provenanceCount: Array.isArray(value.provenance) ? value.provenance.length : 0,
    });
  });
}

export function evaluatePromotionGate({ evidence, validation } = {}) {
  const value = object(evidence, 'evidence');
  const provenance = Array.isArray(value.provenance) ? value.provenance : [];
  const checks = {
    evidenceComplete: Boolean(
      value.experimentId &&
        value.inputSnapshotId &&
        value.candidate?.model &&
        value.candidate?.solver &&
        value.candidate?.version,
    ),
    feasible: value.feasible === true && value.timeout === false,
    provenanceBound: provenance.length >= 2,
    simulationPassed: validation?.simulationPassed === true,
    receiptValid: validation?.receiptValid === true,
    provenanceValid: validation?.provenanceValid === true,
  };
  const passed = Object.values(checks).every(Boolean);
  return Object.freeze({
    status: passed ? 'eligible' : 'rejected',
    checks,
    authoritative: false,
    reason: passed
      ? 'candidate passed evidence and validation gates'
      : 'candidate failed one or more validation gates',
  });
}

export { EVALUATION_VERSION };
