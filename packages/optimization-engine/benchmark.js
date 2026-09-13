import { evaluateQubo } from './quantum-inspired.js';

/**
 * Exact baseline for small QUBOs. This is intentionally bounded: it is a
 * measurement tool for validating heuristic/provider quality, not production
 * optimization for large state spaces.
 */
export function solveQuboExactly({ linear, quadratic = [] } = {}) {
  if (!Array.isArray(linear) || linear.length === 0) {
    throw new TypeError('linear coefficients are required.');
  }
  if (linear.length > 20) {
    throw new RangeError('exact QUBO baseline is limited to 20 binary variables.');
  }

  const states = 2 ** linear.length;
  let best;
  let objective = Number.POSITIVE_INFINITY;

  for (let encoded = 0; encoded < states; encoded += 1) {
    const bits = linear.map((_, index) => (encoded >> index) & 1);
    const score = evaluateQubo(linear, quadratic, bits);
    if (score < objective) {
      objective = score;
      best = bits;
    }
  }

  return Object.freeze({
    backend: 'thergrid-exact-reference-v1',
    algorithm: 'exhaustive-binary-enumeration',
    states,
    bits: best,
    objective,
  });
}

export function compareOptimization(result, exact) {
  if (!result || !exact || typeof result.objective !== 'number' || typeof exact.objective !== 'number') {
    throw new TypeError('optimization and exact results with numeric objectives are required.');
  }

  return Object.freeze({
    objectiveGap: result.objective - exact.objective,
    matchedObjective: result.objective === exact.objective,
    exactBackend: exact.backend,
    candidateBackend: result.backend,
  });
}
