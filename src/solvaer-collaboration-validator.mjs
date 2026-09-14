import { acceptSolvaerOptimizationResult, SOLVAER_OPTIMIZATION_CONTRACT_VERSION, SOLVAER_OPTIMIZATION_CAPABILITY } from './solvaer-optimization-contract.mjs';

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

export function validateSolvaerCollaborationResult({ request, candidate, provenanceRef } = {}) {
  const input = object(request, 'request');
  const result = object(candidate, 'candidate');
  if (input.contractVersion !== SOLVAER_OPTIMIZATION_CONTRACT_VERSION) return false;
  if (input.capability !== SOLVAER_OPTIMIZATION_CAPABILITY) return false;
  if (result.authoritative === true || result.actuatesHardware === true || result.physicalActuation === true) return false;
  try {
    const accepted = acceptSolvaerOptimizationResult({ request: input, candidate: result, provenanceRef });
    return accepted.handoff === 'simulation-required'
      && accepted.safety.advisoryOnly === true
      && accepted.safety.authoritative === false
      && accepted.safety.actuatesHardware === false;
  } catch {
    return false;
  }
}
