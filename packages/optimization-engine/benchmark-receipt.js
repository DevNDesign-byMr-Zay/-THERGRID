import { createHash } from 'node:crypto';
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
  if (quadratic.some((term) => !term || typeof term !== 'object'
    || !Number.isInteger(term.i) || !Number.isInteger(term.j)
    || typeof term.value !== 'number' || !Number.isFinite(term.value))) {
    throw new TypeError('benchmark receipt quadratic coefficients must contain finite indexed terms.');
  }
  if (!Number.isInteger(seed) || seed < 0) {
    throw new TypeError('benchmark receipt seed must be a non-negative integer.');
  }
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new TypeError('benchmark receipt iterations must be a positive integer.');
  }
}

function computeReceiptFingerprint(receipt) {
  const identity = {
    schema: receipt.schema,
    problem: receipt.problem,
    configuration: receipt.configuration,
    reference: receipt.reference,
    candidate: receipt.candidate,
    comparison: receipt.comparison,
  };
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

/**
 * Validate an already-produced receipt before it crosses a package boundary.
 * This is structural evidence validation only; it does not execute a solver.
 */
export function validateBenchmarkReceipt(receipt) {
  if (!receipt || receipt.schema !== 'thergrid-optimization-benchmark-receipt-v1') {
    throw new TypeError('invalid benchmark receipt schema.');
  }
  if (
    !receipt.problem
    || receipt.problem.kind !== 'qubo'
    || receipt.problem.version !== 1
    || !Number.isInteger(receipt.problem.variableCount)
    || receipt.problem.variableCount <= 0
  ) {
    throw new TypeError('invalid benchmark receipt problem.');
  }
  if (
    !receipt.configuration
    || !Number.isInteger(receipt.configuration.seed)
    || receipt.configuration.seed < 0
    || !Number.isInteger(receipt.configuration.iterations)
    || receipt.configuration.iterations <= 0
  ) {
    throw new TypeError('invalid benchmark receipt configuration.');
  }
  for (const side of ['reference', 'candidate']) {
    if (
      !receipt[side]
      || typeof receipt[side].backend !== 'string'
      || typeof receipt[side].algorithm !== 'string'
      || !Number.isFinite(receipt[side].objective)
    ) {
      throw new TypeError(`invalid benchmark receipt ${side}.`);
    }
  }
  if (
    !receipt.comparison
    || !Number.isFinite(receipt.comparison.objectiveGap)
    || typeof receipt.comparison.matchedObjective !== 'boolean'
    || receipt.comparison.exactBackend !== receipt.reference.backend
    || receipt.comparison.candidateBackend !== receipt.candidate.backend
    || receipt.comparison.objectiveGap !== receipt.candidate.objective - receipt.reference.objective
    || receipt.comparison.matchedObjective !== (receipt.candidate.objective === receipt.reference.objective)
  ) {
    throw new TypeError('invalid benchmark receipt comparison.');
  }
  if (typeof receipt.measurementFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.measurementFingerprint)) {
    throw new TypeError('invalid benchmark receipt measurement fingerprint.');
  }
  if (receipt.measurementFingerprint !== computeReceiptFingerprint(receipt)) {
    throw new TypeError('benchmark receipt measurement fingerprint mismatch.');
  }
  if (!Number.isInteger(receipt.durationMs) || receipt.durationMs < 0) {
    throw new TypeError('invalid benchmark receipt duration.');
  }
  return receipt;
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
  const receipt = {
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
  };
  receipt.measurementFingerprint = computeReceiptFingerprint(receipt);
  return validateBenchmarkReceipt(Object.freeze(receipt));
}
