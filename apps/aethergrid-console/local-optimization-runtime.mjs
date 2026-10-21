import { createHash } from 'node:crypto';
// This adapter is intentionally self-contained. The standalone ZIP puts
// server.mjs at its archive root and cannot resolve ../../packages imports.
// Regression tests cross-check it against the maintained reference optimizer.
function evaluateQubo(linear, quadratic, bits) {
  let objective = 0;
  for (let index = 0; index < bits.length; index += 1) {
    objective += linear[index] * bits[index];
  }
  for (let i = 0; i < bits.length; i += 1) {
    for (let j = i + 1; j < bits.length; j += 1) {
      objective += quadratic[i][j] * bits[i] * bits[j];
    }
  }
  return objective;
}

function seededRng(seed) {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

function solveQubo({ linear, quadratic, seed, iterations }) {
  const random = seededRng(seed);
  const bits = linear.map(() => (random() < 0.5 ? 0 : 1));
  let objective = evaluateQubo(linear, quadratic, bits);
  let bestBits = [...bits];
  let bestObjective = objective;
  for (let step = 0; step < iterations; step += 1) {
    const index = Math.floor(random() * bits.length);
    const previous = bits[index];
    bits[index] = previous === 0 ? 1 : 0;
    const candidate = evaluateQubo(linear, quadratic, bits);
    const temperature = Math.max(0.01, 1 - step / iterations);
    const accept = candidate <= objective || random() < Math.exp((objective - candidate) / temperature);
    if (accept) {
      objective = candidate;
      if (objective < bestObjective) {
        bestObjective = objective;
        bestBits = [...bits];
      }
    } else {
      bits[index] = previous;
    }
  }
  return {
    backend: 'aethergrid-portable-cpu-annealer-v1',
    algorithm: 'deterministic-simulated-annealing-qubo',
    seed,
    iterations,
    bits: bestBits,
    objective: Number(bestObjective),
  };
}

const MAX_VARIABLES = 64;
const MAX_EXACT_VARIABLES = 16;
const MAX_ITERATIONS = 10_000;
const MAX_COEFFICIENT = 1_000_000;
const PROVIDER = 'aethergrid-local-cpu';

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validateProblem(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('QUBO input must be an object');
  }
  const { linear, quadratic, seed = 0, iterations = 500 } = input;
  if (
    !Array.isArray(linear) ||
    linear.length < 1 ||
    linear.length > MAX_VARIABLES ||
    linear.some((value) => !Number.isFinite(value) || Math.abs(value) > MAX_COEFFICIENT)
  ) {
    throw new TypeError('linear must have 1–64 finite coefficients bounded to ±1000000');
  }
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new TypeError('seed must be an unsigned 32-bit integer');
  }
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
    throw new TypeError('iterations must be an integer from 1 to 10000');
  }
  const dimension = linear.length;
  const matrix = quadratic == null
    ? Array.from({ length: dimension }, () => Array(dimension).fill(0))
    : quadratic;
  if (
    !Array.isArray(matrix) ||
    matrix.length !== dimension ||
    matrix.some((row) => !Array.isArray(row) || row.length !== dimension)
  ) {
    throw new TypeError('quadratic must be a square NxN array');
  }
  for (let i = 0; i < dimension; i += 1) {
    for (let j = 0; j < dimension; j += 1) {
      const coefficient = matrix[i][j];
      if (!Number.isFinite(coefficient) || Math.abs(coefficient) > MAX_COEFFICIENT) {
        throw new TypeError('quadratic coefficients must be finite and bounded to ±1000000');
      }
      if (j <= i && coefficient !== 0) {
        throw new TypeError('quadratic must have zero diagonal and lower triangle; use upper-triangle QUBO coefficients');
      }
    }
  }
  return {
    linear: [...linear],
    quadratic: matrix.map((row) => [...row]),
    seed,
    iterations,
  };
}

function exactQubo(linear, quadratic) {
  const count = 2 ** linear.length;
  let bestObjective = Infinity;
  let bestBits = null;
  for (let mask = 0; mask < count; mask += 1) {
    const bits = linear.map((_, index) => (mask >>> index) & 1);
    const candidate = evaluateQubo(linear, quadratic, bits);
    if (candidate < bestObjective) {
      bestObjective = candidate;
      bestBits = bits;
    }
  }
  return {
    backend: 'aethergrid-exact-cpu-reference-v1',
    algorithm: 'exhaustive-qubo-search',
    bits: bestBits,
    objective: bestObjective,
    statesEvaluated: count,
    optimalityProven: true,
    hardwareSubmitted: false,
    hardwareExecuted: false,
  };
}

/**
 * Zero-cost reproducible QUBO comparison. CPU optimization is never reported
 * as an executed quantum circuit or hardware-annealing job.
 * Exactness is proven only for <= 16 binary variables.
 */
export function runLocalQuboComparison(input) {
  const problem = validateProblem(input);
  const inputReceipt = sha256(problem);
  const { linear, quadratic, seed, iterations } = problem;
  const result = solveQubo({ linear, quadratic, seed, iterations });
  const annealing = {
    backend: result.backend,
    algorithm: result.algorithm,
    seed: result.seed,
    iterations: result.iterations,
    bits: [...result.bits],
    objective: result.objective,
    optimalityProven: false,
    hardwareSubmitted: false,
    hardwareExecuted: false,
  };
  const exact = linear.length <= MAX_EXACT_VARIABLES ? exactQubo(linear, quadratic) : null;
  const payload = {
    schemaVersion: '1.0',
    problemType: 'qubo',
    provider: PROVIDER,
    executionType: 'classical-cpu',
    hardwareSubmitted: false,
    hardwareExecuted: false,
    advisoryOnly: true,
    dimension: linear.length,
    coefficientConvention: 'linear-plus-strict-upper-triangle',
    inputReceipt,
    annealing,
    exact,
    exactUnavailableReason: exact ? null : 'dimension-exceeds-exact-limit',
    objectiveGap: exact ? annealing.objective - exact.objective : null,
  };
  return { ...payload, receipt: sha256(payload) };
}

export { MAX_EXACT_VARIABLES, MAX_VARIABLES };
