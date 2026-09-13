import { solveQuboExactly } from './exact-reference.js';

/**
 * Measurement helpers for comparing heuristic/provider output against the
 * single maintained exact classical reference.
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

/** Resolve the maintained reference through this measurement boundary. */
export function benchmarkAgainstExact(problem, candidate) {
  const exact = solveQuboExactly(problem);
  return Object.freeze({ exact, comparison: compareOptimization(candidate, exact) });
}
