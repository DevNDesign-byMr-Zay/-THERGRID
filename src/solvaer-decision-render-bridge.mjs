import { evaluateSolvaerDecisionHandoff } from './solvaer-decision-handoff.mjs';
import { createSolvaerCollaborationEvidence } from './solvaer-collaboration-evidence.mjs';
import {
  buildSolvaerOperatorAttention,
  validateSolvaerOperatorAttention,
} from './solvaer-operator-attention.mjs';
import {
  compileHolographicRenderPacket,
  validateHolographicRenderPacket,
} from './holographic-renderer-contract.mjs';

function readOwnData(value, key, path) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if ('get' in descriptor || 'set' in descriptor) {
    throw new TypeError(`${path}.${key} must not use accessors`);
  }
  return descriptor.value;
}

function hasUnsafeAuthority(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${path} must be a plain object`);
  }
  return (
    readOwnData(value, 'authoritative', path) === true ||
    readOwnData(value, 'physicalActuation', path) === true ||
    readOwnData(value, 'actuatesHardware', path) === true ||
    readOwnData(value, 'advisoryOnly', path) === false
  );
}

function rejectAuthority(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return;
  if (hasUnsafeAuthority(candidate, 'candidate')) {
    throw new TypeError(
      'SOLVÆR candidate cannot cross render bridge with physical or authoritative execution authority',
    );
  }
  const safety = readOwnData(candidate, 'safety', 'candidate');
  if (safety != null && hasUnsafeAuthority(safety, 'candidate.safety')) {
    throw new TypeError(
      'SOLVÆR candidate cannot cross render bridge with physical or authoritative execution authority',
    );
  }
}

/**
 * Join SOLVÆR decision evidence to THERGRID's renderer boundary without
 * granting the optimizer presentation or physical execution authority.
 */
export function buildSolvaerDecisionRenderBridge({
  request,
  candidate,
  provenanceRef,
  twinState,
  forecast,
  proposal,
  scene,
  presentation,
} = {}) {
  rejectAuthority(candidate);
  const decision = evaluateSolvaerDecisionHandoff({
    request,
    candidate,
    provenanceRef,
    twinState,
    forecast,
    proposal,
  });
  const collaborationEvidence = createSolvaerCollaborationEvidence({
    request,
    candidate: decision.candidate,
    provenanceRef,
  });
  const operatorAttention = buildSolvaerOperatorAttention({
    evidence: collaborationEvidence,
    decision,
  });
  if (!validateSolvaerOperatorAttention(operatorAttention)) {
    throw new TypeError('SOLVÆR render bridge produced invalid operator attention');
  }
  const renderPacket = compileHolographicRenderPacket({
    scene,
    presentation,
    experimentId: decision.experimentId,
    receiptId: decision.decisionReceipt.receiptId,
    operatorAttentionFingerprint: operatorAttention.attentionFingerprint,
  });
  if (!validateHolographicRenderPacket(renderPacket)) {
    throw new TypeError('SOLVÆR render bridge produced invalid packet');
  }

  return Object.freeze({
    requestId: decision.requestId,
    experimentId: decision.experimentId,
    decision,
    collaborationEvidence,
    operatorAttention,
    renderPacket,
    promotionEligible: false,
    handoff: 'simulation-evidence-required',
    safety: Object.freeze({
      authoritative: false,
      physicalActuation: false,
      actuatesHardware: false,
      advisoryOnly: true,
    }),
  });
}
