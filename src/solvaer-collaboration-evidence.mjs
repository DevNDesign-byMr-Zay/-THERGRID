import { createHash } from 'node:crypto';
import { validateSolvaerCollaborationResult } from './solvaer-collaboration-validator.mjs';

const EVIDENCE_VERSION = 1;

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

function plainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${name} must be a plain object`);
  }
  return value;
}

function validSafety(safety) {
  return (
    safety &&
    typeof safety === 'object' &&
    !Array.isArray(safety) &&
    Object.getPrototypeOf(safety) === Object.prototype &&
    Object.hasOwn(safety, 'authoritative') &&
    Object.hasOwn(safety, 'actuatesHardware') &&
    Object.hasOwn(safety, 'advisoryOnly') &&
    safety.authoritative === false &&
    safety.actuatesHardware === false &&
    safety.advisoryOnly === true
  );
}

/** Bind a validated SOLVÆR candidate to the experiment/snapshot without granting execution authority. */
export function createSolvaerCollaborationEvidence({ request, candidate, provenanceRef } = {}) {
  if (!validateSolvaerCollaborationResult({ request, candidate, provenanceRef })) {
    throw new TypeError('SOLVÆR collaboration result failed validation');
  }
  const evidence = {
    evidenceVersion: EVIDENCE_VERSION,
    experimentId: request.experimentId,
    snapshotId: request.snapshotId,
    capability: request.capability,
    candidate,
    provenanceRef,
    handoff: 'simulation-required',
    safety: { authoritative: false, actuatesHardware: false, advisoryOnly: true },
  };
  return Object.freeze({ ...evidence, evidenceFingerprint: fingerprint(evidence) });
}

export function validateSolvaerCollaborationEvidence(evidence) {
  try {
    plainObject(evidence, 'evidence');
    if (!Object.hasOwn(evidence, 'evidenceVersion') || !Object.hasOwn(evidence, 'handoff') || !Object.hasOwn(evidence, 'safety')) return false;
    if (evidence.evidenceVersion !== EVIDENCE_VERSION || evidence.handoff !== 'simulation-required') return false;
    if (!validSafety(evidence.safety)) return false;
    if (!Object.hasOwn(evidence, 'evidenceFingerprint') || !/^[a-f0-9]{64}$/.test(evidence.evidenceFingerprint)) return false;
    return evidence.evidenceFingerprint === fingerprint({ ...evidence, evidenceFingerprint: undefined });
  } catch {
    return false;
  }
}

export { EVIDENCE_VERSION as SOLVAER_COLLABORATION_EVIDENCE_VERSION };
