import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuboProblem } from './solver-contract.js';
import { createReferenceProvider } from './quantum-inspired-provider.js';
import { createValidatedProvider } from './validated-provider.js';

test('validated provider preserves a valid deterministic result', () => {
  const problem = createQuboProblem({ linear: [-2, -1] });
  const provider = createValidatedProvider(createReferenceProvider({ seed: 7, iterations: 50 }));
  const result = provider.solve(problem);
  assert.deepEqual(result.bits, [1, 1]);
  assert.equal(result.objective, -3);
  assert.equal(result.seed, 7);
});

test('validated provider rejects an invalid provider result', () => {
  const problem = createQuboProblem({ linear: [-1, 1] });
  const provider = createValidatedProvider({
    name: 'invalid',
    solve: () => ({ bits: [1, 2], objective: -1 }),
  });
  assert.throws(() => provider.solve(problem), /must be binary/);
});
