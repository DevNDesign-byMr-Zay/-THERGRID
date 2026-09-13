import { acceptSolvaerOptimizationResult } from './solvaer-optimization-contract.mjs';
import { simulateProposal } from './simulation.mjs';
import { buildDecisionReceipt, fingerprintDecisionReceipt } from './decision-receipt.mjs';

export function evaluateSolvaerDecisionHandoff({ request, candidate, provenanceRef, twinState, proposal }) {
  const accepted = acceptSolvaerOptimizationResult({ request, candidate, provenanceRef });
  const simulation = simulateProposal({ twinState, proposal: candidate.proposal ?? proposal });
  const receipt = buildDecisionReceipt({ twinState, forecast: candidate.forecast ?? null, proposal: candidate.proposal ?? proposal });
  const receiptId = fingerprintDecisionReceipt(receipt);

  return Object.freeze({
    requestId: request.requestId,
    experimentId: request.experimentId,
    candidate: accepted,
    simulation,
    decisionReceipt: Object.freeze({ ...receipt, receiptId }),
    promotionEligible: false,
    handoff: 'simulation-evidence-required',
    safety: Object.freeze({ authoritative: false, actuatesHardware: false, advisoryOnly: true }),
  });
}
