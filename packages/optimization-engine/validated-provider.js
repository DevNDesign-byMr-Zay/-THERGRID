import { normalizeOptimizationResult } from './result-validation.js';

/**
 * Wrap a provider so every returned result crosses the same validation boundary.
 * The wrapper is deliberately transparent about provider identity and does not
 * alter the solver's objective or decision vector.
 */
export function createValidatedProvider(provider) {
  if (!provider || typeof provider.solve !== 'function') {
    throw new TypeError('optimization provider must expose solve(problem).');
  }

  return Object.freeze({
    name: provider.name ?? 'validated-provider',
    solve(problem) {
      const rawResult = provider.solve(problem);
      return normalizeOptimizationResult(problem, rawResult).result;
    },
  });
}
