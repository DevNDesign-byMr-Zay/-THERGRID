import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassicalReferenceAdapter, createQuantumInspiredAdapter } from '../src/solver-adapter.mjs';
import { runSolverCandidates } from '../src/solver-runner.mjs';

const input = {
  experimentId: 'exp-runner-001', snapshotId: 'snapshot-runner-001', proposal: { projectedBalanceKw: 0 }, constraints: { advisoryOnly: true }, seed: 11, provenance: ['receipt-runner-001'],
};

test('runner ranks feasible candidates by objective before runtime', async () => {
  const result = await runSolverCandidates({
    adapters: [createClassicalReferenceAdapter(), createQuantumInspiredAdapter()],
    input: { ...input, objective: 2, feasible: true, runtimeMs: 10 },
    validation: { simulationPassed: true, receiptValid: true, provenanceValid: true },
  });
  assert.equal(result.candidates.length, 2);
  assert.equal(result.ranking.length, 2);
  assert.equal(result.ranking[0].objective, 0);
  assert.equal(result.promotion.status, 'eligible');
  assert.equal(result.authoritative, false);
});

test('runner uses runtime and adapter order as deterministic tie-breakers', async () => {
  const makeAdapter = (model, objective, runtimeMs) => Object.freeze({
    identity: { model, solver: `${model}-solver`, version: 'v1' },
    solve() { return { evaluationVersion: 3, experimentId: input.experimentId, inputSnapshotId: input.snapshotId, candidate: { model, solver: `${model}-solver`, version: 'v1' }, constraints: input.constraints, seed: input.seed, objective, feasible: true, runtimeMs, timeout: false, fallback: null, provenance: ['receipt-001', 'scene-001'] }; },
  });
  const result = await runSolverCandidates({ adapters: [makeAdapter('slow', 1, 8), makeAdapter('fast', 1, 2), makeAdapter('first', 1, 2)], input, validation: { simulationPassed: true, receiptValid: true, provenanceValid: true } });
  assert.equal(result.ranking[0].objective, 1);
  assert.equal(result.ranking[0].runtimeMs, 2);
  assert.equal(result.selectedFingerprint, result.ranking[0].fingerprint);
});

test('runner records timeout/failure without granting promotion', async () => {
  const slowAdapter = Object.freeze({ identity: { model: 'slow', solver: 'slow-test', version: 'v1' }, async solve() { await new Promise((resolve) => setTimeout(resolve, 25)); return { feasible: true, timeout: false, objective: 0, runtimeMs: 25 }; } });
  const result = await runSolverCandidates({ adapters: [slowAdapter], input, timeoutMs: 1 });
  assert.equal(result.failures[0].timeout, true);
  assert.equal(result.promotion.status, 'rejected');
});

test('runner does not self-authorize when validation gates are absent', async () => {
  const result = await runSolverCandidates({ adapters: [createClassicalReferenceAdapter()], input });
  assert.equal(result.promotion.status, 'rejected');
  assert.equal(result.promotion.checks.simulationPassed, false);
  assert.equal(result.promotion.checks.receiptValid, false);
  assert.equal(result.promotion.checks.provenanceValid, false);
});
