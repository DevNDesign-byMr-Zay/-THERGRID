import { benchmarkReference } from './benchmark-harness.js';

/**
 * Turn a benchmark run into a compact, serializable measurement receipt.
 * The receipt records comparison evidence only; it has no actuation semantics.
 */
export function createBenchmarkReceipt({ linear, quadratic = [], seed = 1, iterations = 2000 } = {}) {
  const startedAt = Date.now();
  const benchmark = benchmarkReference({ linear, quadratic, seed, iterations });
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
      backend: benchmark.exact.backend,
      algorithm: benchmark.exact.algorithm,
      objective: benchmark.exact.objective,
    },
    candidate: {
      backend: benchmark.heuristic.backend,
      algorithm: benchmark.heuristic.algorithm,
      objective: benchmark.heuristic.objective,
    },
    comparison: { ...benchmark.comparison },
    durationMs,
  });
}
