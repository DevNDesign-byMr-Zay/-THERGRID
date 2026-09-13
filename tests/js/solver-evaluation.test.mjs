import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSolverEvidence, compareSolverEvidence, evaluatePromotionGate, fingerprintSolverEvidence } from '../../src/solver-evaluation.mjs';

function evidence(overrides = {}) {
  return buildSolverEvidence({
    experimentId: 'exp-1',
    inputSnapshotId: 'snapshot-1',
    candidate: { model: 'classical-reference', solver: 'reference', version: 'v1' },
    seed: 0,
    objective: 0,
    feasible: true,
    runtimeMs: 0,
    provenance: ['receipt-1', 'scene-1'],
    ...overrides,
  });
}

const validValidation = { simulationPassed: true, receiptValid: true, provenanceValid: true };

test('solver evidence fingerprint is deterministic', () => {
  const first = evidence();
  const second = evidence();
  assert.equal(fingerprintSolverEvidence(first), fingerprintSolverEvidence(second));
  assert.deepEqual(compareSolverEvidence([first]), compareSolverEvidence([second]));
});

test('solver evidence fingerprint binds seed and provenance', () => {
  assert.notEqual(fingerprintSolverEvidence(evidence({ seed: 0 })), fingerprintSolverEvidence(evidence({ seed: 1 })));
  assert.notEqual(fingerprintSolverEvidence(evidence({ provenance: ['receipt-1', 'scene-2'] })), fingerprintSolverEvidence(evidence()));
});

test('promotion gate rejects failed simulation', () => {
  const result = evaluatePromotionGate({ evidence: evidence(), validation: { ...validValidation, simulationPassed: false } });
  assert.equal(result.status, 'rejected');
  assert.equal(result.authoritative, false);
});

test('promotion gate rejects solver timeout', () => {
  const result = evaluatePromotionGate({ evidence: evidence({ timeout: true }), validation: validValidation });
  assert.equal(result.status, 'rejected');
  assert.equal(result.checks.feasible, false);
});

test('promotion gate rejects incomplete provenance', () => {
  const result = evaluatePromotionGate({ evidence: evidence({ provenance: [] }), validation: validValidation });
  assert.equal(result.status, 'rejected');
  assert.equal(result.checks.provenanceBound, false);
});

test('promotion gate only marks evidence eligible, never authoritative', () => {
  const result = evaluatePromotionGate({ evidence: evidence(), validation: validValidation });
  assert.equal(result.status, 'eligible');
  assert.equal(result.authoritative, false);
});
