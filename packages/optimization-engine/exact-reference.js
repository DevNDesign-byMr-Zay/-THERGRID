/**
 * Single maintained classical reference for small QUBOs.
 *
 * This is deliberately exhaustive and bounded so candidate providers can be
 * compared against one stable objective implementation.
 */
export function solveQuboExactly({ linear, quadratic = [] } = {}) {
  if (!Array.isArray(linear) || linear.length === 0) {
    throw new TypeError('linear coefficients are required.');
  }
  const variableCount = linear.length;
  if (variableCount > 20) {
    throw new RangeError('exact QUBO reference is limited to 20 variables.');
  }

  const states = 2 ** variableCount;
  let bestBits = null;
  let objective = Number.POSITIVE_INFINITY;

  for (let encoded = 0; encoded < states; encoded += 1) {
    const bits = linear.map((_, index) => (encoded >> index) & 1);
    let score = 0;
    for (let i = 0; i < variableCount; i += 1) {
      score += linear[i] * bits[i];
      for (let j = i + 1; j < variableCount; j += 1) {
        score += (quadratic[i]?.[j] ?? 0) * bits[i] * bits[j];
      }
    }
    if (score < objective) {
      objective = score;
      bestBits = bits;
    }
  }

  return Object.freeze({
    backend: 'thergrid-exact-reference-v1',
    algorithm: 'exhaustive-binary-enumeration',
    states,
    bits: bestBits,
    objective,
  });
}
