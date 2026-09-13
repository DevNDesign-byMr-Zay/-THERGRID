export function validateQuboProblem(problem) {
  if (!problem || problem.kind !== 'qubo' || problem.version !== 1) {
    throw new TypeError('expected version 1 QUBO problem.');
  }
  if (!Array.isArray(problem.linear) || problem.linear.length === 0) {
    throw new TypeError('QUBO linear coefficients are required.');
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
  return {
    problemKind: problem.kind,
    problemVersion: problem.version,
    ...result,
  };
}
