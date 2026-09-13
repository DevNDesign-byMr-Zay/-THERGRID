import { VAELON_CAPABILITY, VAELON_CONTRACT_VERSION, createVaelonResult } from './vaelon-auren.js';

/**
 * Build the smallest collaboration receipt AUREN can consume without
 * depending on a solver implementation. Evidence is descriptive only.
 */
export function createVaelonEvidence({ requestId, result, durationMs = null } = {}) {
  const envelope = createVaelonResult({ requestId, result, durationMs });

  return Object.freeze({
    contract: envelope.contract,
    version: VAELON_CONTRACT_VERSION,
    capability: VAELON_CAPABILITY,
    requestId,
    status: 'completed',
    evidence: Object.freeze({ ...envelope.evidence }),
  });
}
