import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VAELON_CAPABILITY,
  VAELON_CONTRACT_VERSION,
  createVaelonRequest,
  createVaelonResult,
} from './vaelon-auren.js';

test('creates a validated versioned handoff envelope', () => {
  const request = createVaelonRequest({ requestId: 'handoff-001', linear: [-2, 1], quadratic: [[1, 0, 0.5]], seed: 7 });
  assert.equal(request.version, VAELON_CONTRACT_VERSION);
  assert.equal(request.capability, VAELON_CAPABILITY);
  assert.equal(request.problem.kind, 'qubo');
  assert.deepEqual(request.problem.linear, [-2, 1]);
});

test('rejects malformed computational inputs before handoff', () => {
  assert.throws(() => createVaelonRequest({ requestId: 'bad', linear: [NaN] }), /finite numbers/);
  assert.throws(() => createVaelonRequest({ requestId: 'bad', linear: [1], quadratic: [[0, 1, 2]] }), /existing variables/);
  assert.throws(() => createVaelonRequest({ requestId: 'bad', linear: [1], quadratic: [[0, 0, 2]] }), /distinct/);
});

test('returns defensive result data with reproducibility evidence', () => {
  const result = createVaelonResult({ requestId: 'handoff-001', result: { backend: 'reference', algorithm: 'test', seed: 7, objective: -2, bits: [1, 0] }, durationMs: 4 });
  assert.equal(result.version, '1.1');
  assert.equal(result.evidence.objective, -2);
  assert.equal(result.evidence.durationMs, 4);
  assert.deepEqual(result.result.bits, [1, 0]);
});

test('rejects invalid result evidence', () => {
  assert.throws(() => createVaelonResult({ requestId: 'bad', result: { bits: [1, 2], objective: -1 } }), /binary/);
  assert.throws(() => createVaelonResult({ requestId: 'bad', result: { bits: [1], objective: Infinity } }), /finite/);
  assert.throws(() => createVaelonResult({ requestId: 'bad', result: { bits: [1], objective: 1 }, durationMs: -1 }), /non-negative/);
});
