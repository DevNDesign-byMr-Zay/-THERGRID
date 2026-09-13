import { acceptSolvaerOptimizationResult } from './solvaer-optimization-contract.mjs';
import { simulateProposal } from './simulation.mjs';

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

/**
 * Converts a SOLVÆR candidate into the only permitted execution boundary:
 * THERGRID simulation. No candidate is promoted or sent to infrastructure here.
 */
export function evaluateSolvaerCandidate({ request, candidate, provenanceRef, twinState, proposal } = {}) {
  const input = object(request, 'request');
  const state = object(twinState, 'twinState');
  const baseline = object(proposal, 'proposal');
  const accepted = acceptSolvaerOptimizationResult({ request: input, candidate, provenanceRef });
  const simulation = simulateProposal({ twinState: state, proposal: baseline });

  return Object.freeze({
    request: input,
    accepted,
    simulation,
    promotionEligible: false,
    handoff: 'simulation-required',
    safety: { advisoryOnly: true, authoritative: false, actuatesHardware: false },
  });
}
