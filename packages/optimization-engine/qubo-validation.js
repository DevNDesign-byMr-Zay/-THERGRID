import { validateQuboProblem } from './solver-contract.js';

export function validateQuboCoefficients(problem) {
  validateQuboProblem(problem);
  if (problem.linear.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError('QUBO linear coefficients must be finite numbers.');
  }
  for (const term of problem.quadratic ?? []) {
    if (!Array.isArray(term) || term.length !== 3) {
      throw new TypeError('QUBO quadratic terms must be [i, j, coefficient].');
    }
    const [i, j, coefficient] = term;
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= problem.linear.length || j >= problem.linear.length) {
      throw new RangeError('QUBO quadratic indices must reference existing variables.');
    }
    if (i === j) throw new RangeError('QUBO quadratic terms cannot be diagonal.');
    if (typeof coefficient !== 'number' || !Number.isFinite(coefficient)) {
      throw new TypeError('QUBO quadratic coefficients must be finite numbers.');
    }
  }
  return problem;
}

export function normalizeQuboProblem(problem) {
  validateQuboCoefficients(problem);
  const quadratic = [...(problem.quadratic ?? [])].map(([i, j, coefficient]) => {
    const [a, b] = i < j ? [i, j] : [j, i];
    return [a, b, coefficient];
  }).sort(([ai, aj], [bi, bj]) => ai - bi || aj - bj);
  return { kind: 'qubo', version: 1, linear: [...problem.linear], quadratic };
}
