/**
 * Provider-neutral quantum-inspired optimization primitives.
 *
 * This module deliberately has no cloud or hardware dependency. It gives the
 * optimization engine a reproducible binary-search backend that can later be
 * compared with QAOA/annealing providers without changing the problem model.
 */

export function evaluateQubo(linear, quadratic, bits) {
  if (!Array.isArray(bits) || bits.length !== linear.length) {
    throw new TypeError('bits must match the linear coefficient count.');
  }

  let objective = 0;
  for (let i = 0; i < bits.length; i += 1) {
    objective += linear[i] * bits[i];
    for (let j = i + 1; j < bits.length; j += 1) {
      objective += (quadratic[i]?.[j] ?? 0) * bits[i] * bits[j];
    }
  }
  return objective;
}

function seededUnit(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Deterministic simulated-annealing reference backend for QUBO problems.
 * Lower objective values are preferred. The algorithm is intentionally small
 * and auditable so provider results can be compared against it later.
 */
export function solveQubo({ linear, quadratic = [], seed = 1, iterations = 2000 } = {}) {
  if (!Array.isArray(linear) || linear.length === 0) {
    throw new TypeError('linear coefficients are required.');
  }
  if (!Number.isInteger(seed) || seed < 0) throw new TypeError('seed must be a non-negative integer.');
  if (!Number.isInteger(iterations) || iterations < 1) throw new TypeError('iterations must be positive.');

  const random = seededUnit(seed);
  let current = linear.map(() => (random() < 0.5 ? 0 : 1));
  let currentScore = evaluateQubo(linear, quadratic, current);
  let best = [...current];
  let bestScore = currentScore;

  for (let step = 0; step < iterations; step += 1) {
    const index = Math.floor(random() * current.length);
    current[index] = current[index] ? 0 : 1;
    const candidateScore = evaluateQubo(linear, quadratic, current);
    const temperature = Math.max(0.01, 1 - step / iterations);
    const accept = candidateScore <= currentScore
      || random() < Math.exp((currentScore - candidateScore) / temperature);

    if (accept) {
      currentScore = candidateScore;
      if (candidateScore < bestScore) {
        best = [...current];
        bestScore = candidateScore;
      }
    } else {
      current[index] = current[index] ? 0 : 1;
    }
  }

  return {
    backend: 'thergrid-qis-reference-v1',
    algorithm: 'deterministic-simulated-annealing-qubo',
    seed,
    iterations,
    bits: best,
    objective: bestScore,
  };
}
