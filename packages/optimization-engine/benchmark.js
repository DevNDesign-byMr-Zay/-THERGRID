import { solveQuboExactly } from './exact-reference.js';

/**
 * Benchmark comparison helpers consume the maintained exact reference.
 * This module deliberately does not implement a second exhaustive solver.
 */
export { solveQuboExactly } from './exact-reference.js';

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

export function benchmarkOptimization(problem, candidate) {
  const exact = solveQuboExactly(problem);
  return Object.freeze({
    exact,
    comparison: compareOptimization(candidate, exact),
  });
}
