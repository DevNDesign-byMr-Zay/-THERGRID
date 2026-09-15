import { evaluateSolvaerDecisionHandoff } from './solvaer-decision-handoff.mjs';
import { createSolvaerCollaborationEvidence } from './solvaer-collaboration-evidence.mjs';
import { buildSolvaerOperatorAttention, validateSolvaerOperatorAttention } from './solvaer-operator-attention.mjs';
import { compileHolographicRenderPacket, validateHolographicRenderPacket } from './holographic-renderer-contract.mjs';

function rejectAuthority(candidate) {
  const safety = candidate?.safety;
  if (!safety || typeof safety !== 'object') return;
  if (safety.authoritative === true || safety.physicalActuation === true || safety.actuatesHardware === true || safety.advisoryOnly === false) {
    throw new TypeError('SOLVÆR candidate cannot cross render bridge with physical or authoritative execution authority');
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
  const decision = evaluateSolvaerDecisionHandoff({ request, candidate, provenanceRef, twinState, forecast, proposal });
  const collaborationEvidence = createSolvaerCollaborationEvidence({
    request,
    candidate: decision.candidate,
    provenanceRef,
  });
  const operatorAttention = buildSolvaerOperatorAttention({
    evidence: collaborationEvidence,
    decision,
  });
  if (!validateSolvaerOperatorAttention(operatorAttention)) throw new TypeError('SOLVÆR render bridge produced invalid operator attention');
  const renderPacket = compileHolographicRenderPacket({
    scene,
    presentation,
    experimentId: decision.experimentId,
    receiptId: decision.decisionReceipt.receiptId,
    operatorAttentionFingerprint: operatorAttention.attentionFingerprint,
  });
  if (!validateHolographicRenderPacket(renderPacket)) throw new TypeError('SOLVÆR render bridge produced invalid packet');

  return Object.freeze({
    requestId: decision.requestId,
    experimentId: decision.experimentId,
    decision,
    collaborationEvidence,
    operatorAttention,
    renderPacket,
    promotionEligible: false,
    handoff: 'simulation-evidence-required',
    safety: Object.freeze({ authoritative: false, physicalActuation: false, actuatesHardware: false, advisoryOnly: true }),
  });
}
