import { evaluateSolvaerDecisionHandoff } from './solvaer-decision-handoff.mjs';
import { createSolvaerCollaborationEvidence } from './solvaer-collaboration-evidence.mjs';
import { buildSolvaerOperatorAttention, validateSolvaerOperatorAttention } from './solvaer-operator-attention.mjs';
import { compileHolographicRenderPacket, validateHolographicRenderPacket } from './holographic-renderer-contract.mjs';

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
    safety: Object.freeze({ authoritative: false, actuatesHardware: false, advisoryOnly: true }),
  });
}
