import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassicalReferenceAdapter, createQuantumInspiredAdapter, createSolverAdapterContract } from '../src/solver-adapter.mjs';

const input = {
  experimentId: 'exp-001', snapshotId: 'snapshot-001', proposal: { projectedBalanceKw: 2 },
  constraints: { advisoryOnly: true }, seed: 7, provenance: ['receipt-001'],
};

test('classical adapter emits the shared evidence envelope', () => {
  const evidence = createClassicalReferenceAdapter().solve(input);
  assert.equal(evidence.candidate.solver, 'thergrid-reference');
  assert.equal(evidence.feasible, true);
  assert.equal(evidence.timeout, false);
  assert.deepEqual(evidence.provenance, ['receipt-001']);
});

test('quantum-inspired adapter remains evidence-producing and non-authoritative', () => {
  const adapter = createQuantumInspiredAdapter();
  const evidence = adapter.solve({ ...input, objective: 1.25, feasible: true, runtimeMs: 4 });
  assert.equal(evidence.candidate.model, 'quantum-inspired');
  assert.equal(evidence.objective, 1.25);
  assert.equal(createSolverAdapterContract().authoritative, false);
});

test('adapter contract names the future SOLVÆR integration without coupling it to authority', () => {
  const contract = createSolverAdapterContract();
  assert.equal(contract.adapters.includes('solvear-external'), true);
  assert.equal(contract.promotion, 'thergrid-validation-gate-v1');
});
