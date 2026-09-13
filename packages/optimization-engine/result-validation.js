import { validateQuboCoefficients, normalizeQuboProblem } from './qubo-validation.js';

export function validateOptimizationResult(problem, result) {
  validateQuboCoefficients(problem);
  if (!result || !Array.isArray(result.bits) || result.bits.length !== problem.linear.length) {
    throw new TypeError('optimization result bits must match the problem variable count.');
  }
  if (result.bits.some((bit) => bit !== 0 && bit !== 1)) {
    throw new TypeError('optimization result bits must be binary.');
  }
  if (typeof result.objective !== 'number' || !Number.isFinite(result.objective)) {
    throw new TypeError('optimization result objective must be finite.');
  }
  return result;
}

export function normalizeOptimizationResult(problem, result) {
  const normalizedProblem = normalizeQuboProblem(problem);
  validateOptimizationResult(normalizedProblem, result);
  return {
    problem: normalizedProblem,
    result: {
      ...result,
      bits: [...result.bits],
    },
  };
}
