/**
 * Minimal peer-routing contract for VÆLON <-> AUREN collaboration.
 *
 * This module carries capability requests/results only. It intentionally does
 * not import either intelligence layer, so each side can evolve independently.
 */

export const VAELON_CAPABILITY = 'optimization.binary-qubo-reference';
export const VAELON_CONTRACT_VERSION = '1.0';

export function createVaelonRequest({ requestId, sender = 'AUREN', linear, quadratic = [], seed = 1 } = {}) {
  if (typeof requestId !== 'string' || requestId.length === 0) {
    throw new TypeError('requestId is required.');
  }
  if (!Array.isArray(linear) || linear.length === 0) {
    throw new TypeError('linear coefficients are required.');
  }
  if (!Array.isArray(quadratic)) throw new TypeError('quadratic must be an array.');
  if (!Number.isInteger(seed) || seed < 0) throw new TypeError('seed must be a non-negative integer.');

  return {
    contract: 'thergrid.model-routing',
    version: VAELON_CONTRACT_VERSION,
    capability: VAELON_CAPABILITY,
    sender,
    target: 'VÆLON',
    requestId,
    problem: { linear, quadratic, seed },
  };
}

export function createVaelonResult({ requestId, result, durationMs = null } = {}) {
  if (typeof requestId !== 'string' || requestId.length === 0) {
    throw new TypeError('requestId is required.');
  }
  if (!result || typeof result !== 'object') throw new TypeError('result is required.');

  return {
    contract: 'thergrid.model-routing',
    version: VAELON_CONTRACT_VERSION,
    capability: VAELON_CAPABILITY,
    source: 'VÆLON',
    requestId,
    result,
    evidence: {
      backend: result.backend ?? null,
      algorithm: result.algorithm ?? null,
      seed: result.seed ?? null,
      objective: result.objective ?? null,
      durationMs,
    },
  };
}
