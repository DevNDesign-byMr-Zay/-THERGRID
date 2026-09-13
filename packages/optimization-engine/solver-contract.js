export function validateQuboProblem(problem) {
  if (!problem || problem.kind !== 'qubo' || problem.version !== 1) {
    throw new TypeError('expected version 1 QUBO problem.');
  }
  if (!Array.isArray(problem.linear) || problem.linear.length === 0) {
    throw new TypeError('QUBO linear coefficients are required.');
  }
  if (problem.linear.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError('QUBO linear coefficients must be finite numbers.');
  }
  if (problem.quadratic !== undefined && !Array.isArray(problem.quadratic)) {
    throw new TypeError('QUBO quadratic coefficients must be an array.');
  }
  return problem;
}

export function createQuboProblem({ linear, quadratic = [] } = {}) {
  return validateQuboProblem({ kind: 'qubo', version: 1, linear, quadratic });
}

export function runOptimization(provider, problem) {
  validateQuboProblem(problem);
  if (!provider || typeof provider.solve !== 'function') {
    throw new TypeError('optimization provider must expose solve(problem).');
  }
  const result = provider.solve(problem);
  if (!result || !Array.isArray(result.bits) || result.bits.length !== problem.linear.length) {
    throw new TypeError('optimization provider returned a mismatched binary result.');
  }
  if (result.bits.some((bit) => bit !== 0 && bit !== 1)) {
    throw new TypeError('optimization provider returned non-binary result data.');
  }
  if (!Number.isFinite(result.objective)) {
    throw new TypeError('optimization provider returned a non-finite objective.');
  }
  return {
    problemKind: problem.kind,
    problemVersion: problem.version,
    ...result,
  };
}
