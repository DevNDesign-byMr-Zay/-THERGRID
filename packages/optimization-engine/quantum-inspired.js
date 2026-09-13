const BACKEND = 'thergrid-qis-reference-v1';
const ALGORITHM = 'deterministic-simulated-annealing-qubo';

function assertVector(value, name) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${name} must be a non-empty array`);
  if (value.some((item) => !Number.isFinite(item))) throw new TypeError(`${name} entries must be finite`);
}

function assertMatrix(value, size, name) {
  if (!Array.isArray(value) || value.length !== size) throw new TypeError(`${name} must be a ${size}x${size} matrix`);
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== size || row.some((item) => !Number.isFinite(item))) throw new TypeError(`${name} must be a ${size}x${size} finite matrix`);
  }
}

function assertBits(bits, size) {
  if (!Array.isArray(bits) || bits.length !== size || bits.some((bit) => bit !== 0 && bit !== 1)) throw new TypeError(`bits must contain exactly ${size} binary values`);
}

function rng(seed) {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

export function evaluateQubo(linear, quadratic, bits) {
  assertVector(linear, 'linear');
  assertMatrix(quadratic, linear.length, 'quadratic');
  assertBits(bits, linear.length);

  let objective = 0;
  for (let i = 0; i < bits.length; i += 1) objective += linear[i] * bits[i];
  for (let i = 0; i < bits.length; i += 1) {
    for (let j = i + 1; j < bits.length; j += 1) objective += quadratic[i][j] * bits[i] * bits[j];
  }
  return objective;
}

export function solveQubo({ linear, quadratic = null, seed = 0, iterations = 500 } = {}) {
  assertVector(linear, 'linear');
  const matrix = quadratic ?? linear.map(() => linear.map(() => 0));
  assertMatrix(matrix, linear.length, 'quadratic');
  if (!Number.isInteger(seed) || !Number.isFinite(seed)) throw new TypeError('seed must be an integer');
  if (!Number.isInteger(iterations) || iterations <= 0) throw new TypeError('iterations must be a positive integer');

  const random = rng(seed);
  const bits = linear.map(() => (random() < 0.5 ? 0 : 1));
  let objective = evaluateQubo(linear, matrix, bits);
  let bestBits = [...bits];
  let bestObjective = objective;

  for (let step = 0; step < iterations; step += 1) {
    const index = Math.floor(random() * bits.length);
    const previous = bits[index];
    bits[index] = previous === 0 ? 1 : 0;
    const candidate = evaluateQubo(linear, matrix, bits);
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

  return Object.freeze({
    backend: BACKEND,
    algorithm: ALGORITHM,
    seed,
    iterations,
    bits: Object.freeze(bestBits),
    objective: Number(bestObjective),
    deterministic: true,
  });
}

export { BACKEND, ALGORITHM };
