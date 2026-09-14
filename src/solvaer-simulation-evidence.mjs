import { createHash } from 'node:crypto';

const SIMULATION_EVIDENCE_VERSION = 1;

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function snapshot(value, name = 'simulation', seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${name} numbers must be finite`);
    return value;
  }
  if (!value || typeof value !== 'object') {
    throw new TypeError(`${name} must contain JSON-compatible evidence`);
  }
  if (seen.has(value)) throw new TypeError(`${name} must not contain circular references`);
  seen.add(value);
  const copy = Array.isArray(value)
    ? value.map((item, index) => snapshot(item, `${name}[${index}]`, seen))
    : Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, snapshot(child, `${name}.${key}`, seen)]),
      );
  seen.delete(value);
  return copy;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}

function evidenceBody({ accepted, collaborationEvidenceRef, simulation }) {
  const result = object(accepted, 'accepted');
  const reference = object(collaborationEvidenceRef, 'collaborationEvidenceRef');
  const simulated = object(simulation, 'simulation');

  const requestId = text(result.requestId, 'accepted.requestId');
  const experimentId = text(result.experimentId, 'accepted.experimentId');
  const snapshotId = text(result.snapshotId, 'accepted.snapshotId');
  const evidenceFingerprint = text(
    reference.evidenceFingerprint,
    'collaborationEvidenceRef.evidenceFingerprint',
  );
  if (!/^[a-f0-9]{64}$/.test(evidenceFingerprint)) {
    throw new TypeError('collaboration evidence fingerprint must be SHA-256');
  }
  if (reference.requestId !== requestId) {
    throw new TypeError('collaboration evidence requestId must match accepted request');
  }
  if (reference.experimentId !== experimentId) {
    throw new TypeError('collaboration evidence experimentId must match accepted request');
  }
  if (reference.snapshotId !== snapshotId) {
    throw new TypeError('collaboration evidence snapshotId must match accepted request');
  }
  if (simulated.snapshotId !== snapshotId) {
    throw new TypeError('simulation snapshotId must match accepted request');
  }
  if (
    simulated.deterministic !== true ||
    simulated.safety?.advisoryOnly !== true ||
    simulated.safety?.physicalActuation !== false
  ) {
    throw new TypeError('simulation must remain deterministic, advisory-only, and non-actuating');
  }

  return {
    version: SIMULATION_EVIDENCE_VERSION,
    requestId,
    experimentId,
    snapshotId,
    collaborationEvidenceFingerprint: evidenceFingerprint,
    simulation: deepFreeze(snapshot(simulated)),
    promotionEligible: false,
    handoff: 'simulation-evidence-only',
    safety: {
      advisoryOnly: true,
      authoritative: false,
      actuatesHardware: false,
      promotesCandidate: false,
    },
  };
}

export function createSolvaerSimulationEvidence(input) {
  const body = evidenceBody(input);
  return deepFreeze({
    ...body,
    simulationEvidenceFingerprint: fingerprint(body),
  });
}

export function validateSolvaerSimulationEvidence(evidence, source) {
  try {
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return false;
    if (!/^[a-f0-9]{64}$/.test(evidence.simulationEvidenceFingerprint)) return false;
    const expectedBody = evidenceBody(source);
    const actualBody = Object.fromEntries(
      Object.entries(evidence).filter(([key]) => key !== 'simulationEvidenceFingerprint'),
    );
    if (JSON.stringify(canonical(actualBody)) !== JSON.stringify(canonical(expectedBody))) return false;
    return evidence.simulationEvidenceFingerprint === fingerprint(expectedBody);
  } catch {
    return false;
  }
}

export { SIMULATION_EVIDENCE_VERSION as SOLVAER_SIMULATION_EVIDENCE_VERSION };
