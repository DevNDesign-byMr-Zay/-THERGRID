import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSolvaerOperatorAttention } from '../src/solvaer-operator-attention.mjs';

const base = {
  version: 1,
  experimentId: 'experiment-1',
  snapshotId: 'snapshot-1',
  requestId: 'request-1',
  items: [{ priority: 40, severity: 'info', evidenceRef: 'evidence-1', advisoryOnly: true }],
  safety: { authoritative: false, actuatesHardware: false, advisoryOnly: true },
};

test('accepts a complete operator attention identity', () => {
  assert.equal(validateSolvaerOperatorAttention(base), true);
});

test('rejects missing experiment, snapshot, request, or evidence identity', () => {
  for (const field of ['experimentId', 'snapshotId', 'requestId']) {
    const candidate = { ...base, [field]: '' };
    assert.equal(validateSolvaerOperatorAttention(candidate), false, field);
  }
  assert.equal(validateSolvaerOperatorAttention({ ...base, items: [{ ...base.items[0], evidenceRef: '' }] }), false);
});

test('rejects unsafe attention state', () => {
  assert.equal(validateSolvaerOperatorAttention({ ...base, safety: { ...base.safety, authoritative: true } }), false);
  assert.equal(validateSolvaerOperatorAttention({ ...base, safety: { ...base.safety, actuatesHardware: true } }), false);
});
