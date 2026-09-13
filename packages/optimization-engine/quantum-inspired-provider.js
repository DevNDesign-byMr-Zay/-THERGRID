import { solveQubo } from './quantum-inspired.js';

export function createReferenceProvider({ seed = 1, iterations = 2000 } = {}) {
  return {
    name: 'thergrid-qis-reference-v1',
    solve(problem) {
      const result = solveQubo({
        linear: problem.linear,
        quadratic: problem.quadratic,
        seed,
        iterations,
      });
      return result;
    },
  };
}
