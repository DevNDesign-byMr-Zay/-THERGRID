import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSolverEvidence,
  compareSolverEvidence,
  evaluatePromotionGate,
  fingerprintSolverEvidence,
} from '../../src/solver-evaluation.mjs';

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

test('solver evidence snapshots and deeply freezes caller-owned constraints', () => {
  const constraints = {
    bounds: { maxDeltaKw: 5 },
    weights: [1, 2, 3],
  };
  const built = evidence({ constraints });
  const fingerprint = fingerprintSolverEvidence(built);

  assert.equal(Object.isFrozen(built), true);
  assert.equal(Object.isFrozen(built.candidate), true);
  assert.equal(Object.isFrozen(built.constraints), true);
  assert.equal(Object.isFrozen(built.constraints.bounds), true);
  assert.equal(Object.isFrozen(built.constraints.weights), true);
  assert.equal(Object.isFrozen(built.provenance), true);

  constraints.bounds.maxDeltaKw = 99;
  constraints.weights[0] = 99;

  assert.equal(built.constraints.bounds.maxDeltaKw, 5);
  assert.deepEqual(built.constraints.weights, [1, 2, 3]);
  assert.equal(fingerprintSolverEvidence(built), fingerprint);
  assert.throws(() => {
    built.constraints.bounds.maxDeltaKw = 10;
  }, TypeError);
});

test('solver evidence rejects non-data constraint objects and circular evidence', () => {
  assert.throws(() => evidence({ constraints: new Date() }), /constraints must use plain objects/);

  const circular = {};
  circular.self = circular;
  assert.throws(
    () => evidence({ constraints: circular }),
    /constraints\.self must not contain circular references/,
  );
});

test('solver evidence fingerprint binds seed and provenance', () => {
  assert.notEqual(
    fingerprintSolverEvidence(evidence({ seed: 0 })),
    fingerprintSolverEvidence(evidence({ seed: 1 })),
  );
  assert.notEqual(
    fingerprintSolverEvidence(evidence({ provenance: ['receipt-1', 'scene-2'] })),
    fingerprintSolverEvidence(evidence()),
  );
});

test('promotion gate rejects failed simulation', () => {
  const result = evaluatePromotionGate({
    evidence: evidence(),
    validation: { ...validValidation, simulationPassed: false },
  });
  assert.equal(result.status, 'rejected');
  assert.equal(result.authoritative, false);
});

test('promotion gate rejects solver timeout', () => {
  const result = evaluatePromotionGate({
    evidence: evidence({ timeout: true }),
    validation: validValidation,
  });
  assert.equal(result.status, 'rejected');
  assert.equal(result.checks.feasible, false);
});

test('promotion gate rejects incomplete provenance', () => {
  const result = evaluatePromotionGate({
    evidence: evidence({ provenance: [] }),
    validation: validValidation,
  });
  assert.equal(result.status, 'rejected');
  assert.equal(result.checks.provenanceBound, false);
});

test('promotion gate only marks evidence eligible, never authoritative', () => {
  const result = evaluatePromotionGate({ evidence: evidence(), validation: validValidation });
  assert.equal(result.status, 'eligible');
  assert.equal(result.authoritative, false);
});
