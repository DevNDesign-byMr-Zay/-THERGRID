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

/** Bind a validated SOLVÆR candidate to the request/experiment/snapshot without granting execution authority. */
export function createSolvaerCollaborationEvidence({ request, candidate, provenanceRef } = {}) {
  if (!validateSolvaerCollaborationResult({ request, candidate, provenanceRef })) {
    throw new TypeError('SOLVÆR collaboration result failed validation');
  }
  if (typeof request.requestId !== 'string' || !request.requestId.trim()) {
    throw new TypeError('SOLVÆR requestId is required for collaboration evidence');
  }
  const evidence = {
    evidenceVersion: EVIDENCE_VERSION,
    requestId: request.requestId.trim(),
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
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return false;
    if (evidence.evidenceVersion !== EVIDENCE_VERSION || evidence.handoff !== 'simulation-required') return false;
    if (typeof evidence.requestId !== 'string' || !evidence.requestId.trim()) return false;
    if (!evidence.safety || evidence.safety.authoritative !== false || evidence.safety.actuatesHardware !== false || evidence.safety.advisoryOnly !== true) return false;
    if (!/^[a-f0-9]{64}$/.test(evidence.evidenceFingerprint)) return false;
    return evidence.evidenceFingerprint === fingerprint({ ...evidence, evidenceFingerprint: undefined });
  } catch {
    return false;
  }
}

export { EVIDENCE_VERSION as SOLVAER_COLLABORATION_EVIDENCE_VERSION };
