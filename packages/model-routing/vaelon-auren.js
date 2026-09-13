/**
 * Versioned peer-routing boundary for VÆLON <-> AUREN collaboration.
 *
 * The envelope carries computation requests/results only. It does not import
 * either intelligence layer, mutate telemetry, or imply actuation authority.
 */

export const VAELON_CAPABILITY = 'optimization.binary-qubo-reference';
export const VAELON_CONTRACT_VERSION = '1.1';

function requireRequestId(requestId) {
  if (typeof requestId !== 'string' || requestId.length === 0) {
    throw new TypeError('requestId is required.');
  }
}

function validateCoefficients(linear, quadratic) {
  if (!Array.isArray(linear) || linear.length === 0) {
    throw new TypeError('linear coefficients are required.');
  }
  if (linear.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError('linear coefficients must be finite numbers.');
  }
  if (!Array.isArray(quadratic)) throw new TypeError('quadratic must be an array.');
  for (const term of quadratic) {
    if (!Array.isArray(term) || term.length !== 3) {
      throw new TypeError('quadratic terms must be [i, j, coefficient].');
    }
    const [i, j, coefficient] = term;
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= linear.length || j >= linear.length || i === j) {
      throw new RangeError('quadratic indices must reference distinct existing variables.');
    }
    if (typeof coefficient !== 'number' || !Number.isFinite(coefficient)) {
      throw new TypeError('quadratic coefficients must be finite numbers.');
    }
  }
}

export function createVaelonRequest({ requestId, sender = 'AUREN', linear, quadratic = [], seed = 1 } = {}) {
  requireRequestId(requestId);
  if (typeof sender !== 'string' || sender.length === 0) throw new TypeError('sender is required.');
  if (!Number.isInteger(seed) || seed < 0) throw new TypeError('seed must be a non-negative integer.');
  validateCoefficients(linear, quadratic);

  return {
    contract: 'thergrid.model-routing',
    version: VAELON_CONTRACT_VERSION,
    capability: VAELON_CAPABILITY,
    sender,
    target: 'VÆLON',
    requestId,
    problem: { kind: 'qubo', version: 1, linear: [...linear], quadratic: quadratic.map((term) => [...term]), seed },
  };
}

export function createVaelonResult({ requestId, result, durationMs = null } = {}) {
  requireRequestId(requestId);
  if (!result || typeof result !== 'object') throw new TypeError('result is required.');
  if (!Array.isArray(result.bits)) throw new TypeError('result bits are required.');
  if (result.bits.some((bit) => bit !== 0 && bit !== 1)) throw new TypeError('result bits must be binary.');
  if (!Number.isFinite(result.objective)) throw new TypeError('result objective must be finite.');
  if (durationMs !== null && (!Number.isFinite(durationMs) || durationMs < 0)) throw new TypeError('durationMs must be non-negative.');

  return {
    contract: 'thergrid.model-routing',
    version: VAELON_CONTRACT_VERSION,
    capability: VAELON_CAPABILITY,
    source: 'VÆLON',
    requestId,
    result: { ...result, bits: [...result.bits] },
    evidence: {
      backend: result.backend ?? null,
      algorithm: result.algorithm ?? null,
      seed: result.seed ?? null,
      objective: result.objective,
      durationMs,
    },
  };
}
