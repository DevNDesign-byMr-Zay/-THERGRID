import { fingerprintDecisionReceipt } from './decision-receipt.mjs';
import { buildModelEvidence } from './model-routing.mjs';
import { fingerprintSolverEvidence } from './solver-evaluation.mjs';

const HANDOFF_VERSION = 1;
const OPTIMIZATION_CAPABILITY = 'optimization.explore';

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

export function buildVaelonAurenEvidenceHandoff({
  requestId,
  route,
  solverEvidence,
  decisionReceipt,
} = {}) {
  const evidence = object(solverEvidence, 'solverEvidence');
  const receipt = object(decisionReceipt, 'decisionReceipt');
  const resolvedRequestId = text(requestId, 'requestId');
  const snapshotId = text(evidence.inputSnapshotId, 'solverEvidence.inputSnapshotId');

  if (receipt.snapshotId !== snapshotId) {
    throw new TypeError('decisionReceipt.snapshotId must match solverEvidence.inputSnapshotId');
  }

  const routing = buildModelEvidence({
    route,
    capability: OPTIMIZATION_CAPABILITY,
    status: 'completed',
    fallbackUsed: evidence.fallback != null,
  });

  if (routing.model !== 'VÆLON') {
    throw new TypeError('optimization evidence handoff must use the VÆLON route');
  }

  const candidate = object(evidence.candidate, 'solverEvidence.candidate');
  const provenance = Array.isArray(evidence.provenance) ? [...evidence.provenance] : [];

  return Object.freeze({
    handoffVersion: HANDOFF_VERSION,
    requestId: resolvedRequestId,
    snapshotId,
    decisionReceiptFingerprint: fingerprintDecisionReceipt(receipt),
    solverEvidenceFingerprint: fingerprintSolverEvidence(evidence),
    routing: Object.freeze({ ...routing }),
    solver: Object.freeze({
      experimentId: text(evidence.experimentId, 'solverEvidence.experimentId'),
      candidate: Object.freeze({ ...candidate }),
      seed: evidence.seed ?? null,
      objective: evidence.objective,
      feasible: evidence.feasible === true,
      runtimeMs: evidence.runtimeMs,
      timeout: evidence.timeout === true,
      fallback: evidence.fallback ?? null,
      provenance: Object.freeze(provenance),
    }),
    safety: Object.freeze({
      observationalOnly: true,
      authoritative: false,
      physicalActuation: false,
    }),
  });
}

export { HANDOFF_VERSION, OPTIMIZATION_CAPABILITY };
