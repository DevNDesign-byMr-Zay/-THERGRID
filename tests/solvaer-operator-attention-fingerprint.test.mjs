import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSolvaerOperatorAttention, validateSolvaerOperatorAttention } from '../src/solvaer-operator-attention.mjs';

const evidence = {
  evidenceVersion: 1,
  experimentId: 'exp-attention-1',
  snapshotId: 'snap-1',
  capability: 'optimization.explore',
  candidate: { candidateId: 'candidate-1' },
  provenanceRef: 'provenance:exp-attention-1',
  handoff: 'simulation-required',
  safety: { authoritative: false, actuatesHardware: false, advisoryOnly: true },
};

// Match the evidence validator's deterministic fingerprint contract.
import { createHash } from 'node:crypto';
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}
Object.assign(evidence, { evidenceFingerprint: fingerprint(evidence) });

const decision = { experimentId: 'exp-attention-1', requestId: 'request-1', simulation: { status: 'passed' } };

test('fingerprints a validated operator attention artifact', async () => {
  const attention = buildSolvaerOperatorAttention({ evidence, decision });
  assert.equal(attention.version, 2);
  assert.match(attention.attentionFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(validateSolvaerOperatorAttention(attention), true);
});

test('rejects a tampered operator attention artifact', () => {
  const attention = buildSolvaerOperatorAttention({ evidence, decision });
  const tampered = { ...attention, items: attention.items.map((item) => ({ ...item, priority: item.priority + 1 })) };
  assert.equal(validateSolvaerOperatorAttention(tampered), false);
});
