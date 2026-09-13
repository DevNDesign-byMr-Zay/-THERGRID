/**
 * Provider-neutral optimization contract.
 *
 * The reference solver remains the control implementation. External quantum
 * or quantum-inspired providers can implement the same solve(problem) shape
 * without changing callers or allowing a provider to become authoritative.
 */

export function createQuboProblem({ linear, quadratic = [] } = {}) {
  if (!Array.isArray(linear) || linear.length === 0) {
    throw new TypeError('linear coefficients are required.');
  }
  if (!Array.isArray(quadratic)) {
    throw new TypeError('quadratic coefficients must be an array.');
  }

  return Object.freeze({
    kind: 'qubo',
    version: 1,
    linear: [...linear],
    quadratic: quadratic.map((row) => (Array.isArray(row) ? [...row] : row)),
  });
}

export function runOptimization(provider, problem) {
  if (!provider || typeof provider.solve !== 'function') {
    throw new TypeError('provider.solve(problem) is required.');
  }
  if (!problem || problem.kind !== 'qubo' || problem.version !== 1) {
    throw new TypeError('a version 1 QUBO problem is required.');
  }

  const result = provider.solve(problem);
  if (!result || typeof result !== 'object') {
    throw new TypeError('provider must return an optimization result object.');
  }

  return Object.freeze({
    ...result,
    problemKind: problem.kind,
    problemVersion: problem.version,
  });
}
