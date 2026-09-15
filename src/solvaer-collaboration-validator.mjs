import {
  acceptSolvaerOptimizationResult,
  SOLVAER_OPTIMIZATION_CONTRACT_VERSION,
  SOLVAER_OPTIMIZATION_CAPABILITY,
  SOLVAER_PRODUCER_IDENTITY,
} from './solvaer-optimization-contract.mjs';

function object(value, name) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${name} must be a plain object`);
  }
  return value;
}

function sameIdentity(actual, expected) {
  return (
    actual != null &&
    typeof actual === 'object' &&
    !Array.isArray(actual) &&
    Object.getPrototypeOf(actual) === Object.prototype &&
    Object.hasOwn(actual, 'family') &&
    Object.hasOwn(actual, 'role') &&
    Object.hasOwn(actual, 'contract') &&
    actual.family === expected.family &&
    actual.role === expected.role &&
    actual.contract === expected.contract
  );
}

export function validateSolvaerCollaborationResult({ request, candidate, provenanceRef } = {}) {
  try {
    const input = object(request, 'request');
    const result = object(candidate, 'candidate');
    const provenance = object(provenanceRef, 'provenanceRef');

    if (input.contractVersion !== SOLVAER_OPTIMIZATION_CONTRACT_VERSION) return false;
    if (input.capability !== SOLVAER_OPTIMIZATION_CAPABILITY) return false;
    if (!sameIdentity(input.producerIdentity, SOLVAER_PRODUCER_IDENTITY)) return false;

    if (
      result.authoritative === true ||
      result.actuatesHardware === true ||
      result.physicalActuation === true
    ) {
      return false;
    }
    if (
      result.producerIdentity != null &&
      !sameIdentity(result.producerIdentity, SOLVAER_PRODUCER_IDENTITY)
    ) {
      return false;
    }
    if (
      provenance.producerIdentity != null &&
      !sameIdentity(provenance.producerIdentity, SOLVAER_PRODUCER_IDENTITY)
    ) {
      return false;
    }

    const accepted = acceptSolvaerOptimizationResult({
      request: input,
      candidate: result,
      provenanceRef: provenance,
    });
    return (
      accepted.handoff === 'simulation-required' &&
      accepted.safety.advisoryOnly === true &&
      accepted.safety.authoritative === false &&
      accepted.safety.actuatesHardware === false &&
      sameIdentity(accepted.producerIdentity, SOLVAER_PRODUCER_IDENTITY)
    );
  } catch {
    return false;
  }
}
