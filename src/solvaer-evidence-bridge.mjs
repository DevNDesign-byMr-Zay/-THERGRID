import { createHash } from 'node:crypto';
import { acceptSolvaerOptimizationResult } from './solvaer-optimization-contract.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

export function fingerprintSolvaerEvidence(evidence) {
  return createHash('sha256').update(JSON.stringify(canonical(evidence)), 'utf8').digest('hex');
}

export function createSolvaerEvidenceBridge({ request, candidate, provenanceRef, simulation, decisionReceipt } = {}) {
  const accepted = acceptSolvaerOptimizationResult({ request, candidate, provenanceRef });
  if (!simulation || typeof simulation !== 'object' || Array.isArray(simulation)) throw new TypeError('simulation must be an object');
  if (!decisionReceipt || typeof decisionReceipt !== 'object' || Array.isArray(decisionReceipt)) throw new TypeError('decisionReceipt must be an object');
  const body = {
    contractVersion: 1,
    experimentId: text(request.experimentId, 'request.experimentId'),
    snapshotId: text(request.snapshotId, 'request.snapshotId'),
    capability: accepted.capability,
    candidate: accepted.candidate,
    simulationStatus: text(simulation.status, 'simulation.status'),
    receiptId: text(decisionReceipt.receiptId, 'decisionReceipt.receiptId'),
    handoff: accepted.handoff,
    safety: { authoritative: false, actuatesHardware: false, advisoryOnly: true },
  };
  return Object.freeze({ ...body, fingerprint: fingerprintSolvaerEvidence(body) });
}

export function validateSolvaerEvidenceBridge(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return false;
  if (evidence.contractVersion !== 1 || typeof evidence.fingerprint !== 'string') return false;
  const { fingerprint, ...body } = evidence;
  if (body.safety?.authoritative !== false || body.safety?.actuatesHardware !== false || body.safety?.advisoryOnly !== true) return false;
  return fingerprintSolvaerEvidence(body) === fingerprint;
}
