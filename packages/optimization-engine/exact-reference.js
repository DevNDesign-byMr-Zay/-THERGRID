export function solveQuboExactly({ linear, quadratic = [] } = {}) {
  if (!Array.isArray(linear) || linear.length === 0) {
    throw new TypeError('linear coefficients are required.');
  }
  const variableCount = linear.length;
  if (variableCount > 20) {
    throw new RangeError('exact QUBO reference is limited to 20 variables.');
  }

  let bestBits = null;
  let bestObjective = Number.POSITIVE_INFINITY;
  const combinations = 2 ** variableCount;

  for (let mask = 0; mask < combinations; mask += 1) {
    const bits = Array.from({ length: variableCount }, (_, index) => (mask >> index) & 1);
    let objective = 0;
    for (let i = 0; i < variableCount; i += 1) {
      objective += linear[i] * bits[i];
      for (let j = i + 1; j < variableCount; j += 1) {
        objective += (quadratic[i]?.[j] ?? 0) * bits[i] * bits[j];
      }
    }
    if (objective < bestObjective) {
      bestObjective = objective;
      bestBits = bits;
    }
  }

  return {
    backend: 'thergrid-classical-exact-reference-v1',
    algorithm: 'exhaustive-binary-search',
    variables: variableCount,
    bits: bestBits,
    objective: bestObjective,
  };
}
