import { solveQuboExactly, compareOptimization } from './benchmark.js';
import { createReferenceProvider } from './quantum-inspired-provider.js';

/**
 * Turn a benchmark run into a compact, serializable measurement receipt.
 * The receipt records comparison evidence only; it has no actuation semantics.
 */
export function createBenchmarkReceipt({ linear, quadratic = [], seed = 1, iterations = 2000 } = {}) {
  const startedAt = Date.now();
  const exact = solveQuboExactly({ linear, quadratic });
  const candidate = createReferenceProvider({ seed, iterations }).solve({
    kind: 'qubo',
    version: 1,
    linear,
    quadratic,
  });
  const comparison = compareOptimization(candidate, exact);
  const durationMs = Date.now() - startedAt;

  return Object.freeze({
    schema: 'thergrid-optimization-benchmark-receipt-v1',
    problem: {
      kind: 'qubo',
      version: 1,
      variableCount: linear.length,
    },
    configuration: { seed, iterations },
    reference: {
      backend: exact.backend,
      algorithm: exact.algorithm,
      objective: exact.objective,
    },
    candidate: {
      backend: candidate.backend,
      algorithm: candidate.algorithm,
      objective: candidate.objective,
    },
    comparison: { ...comparison },
    durationMs,
  });
}
