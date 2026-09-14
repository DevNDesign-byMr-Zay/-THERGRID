import { solveQuboExactly, compareOptimization } from './benchmark.js';
import { createReferenceProvider } from './quantum-inspired-provider.js';

function validateReceiptInput({ linear, quadratic, seed, iterations }) {
  if (!Array.isArray(linear) || linear.length === 0) {
    throw new TypeError('benchmark receipt linear coefficients are required.');
  }
  if (linear.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError('benchmark receipt linear coefficients must be finite numbers.');
  }
  if (!Array.isArray(quadratic)) {
    throw new TypeError('benchmark receipt quadratic coefficients must be an array.');
  }
  if (!Number.isInteger(seed) || seed < 0) {
    throw new TypeError('benchmark receipt seed must be a non-negative integer.');
  }
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new TypeError('benchmark receipt iterations must be a positive integer.');
  }
}

/**
 * Turn a benchmark run into a compact, serializable measurement receipt.
 * The receipt records comparison evidence only; it has no actuation semantics.
 */
export function createBenchmarkReceipt({ linear, quadratic = [], seed = 1, iterations = 2000 } = {}) {
  validateReceiptInput({ linear, quadratic, seed, iterations });
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
