import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { evaluateSolvaerDecisionHandoff } from '../src/solvaer-decision-handoff.mjs';
import { buildSolvaerOperatorAttention, validateSolvaerOperatorAttention } from '../src/solvaer-operator-attention.mjs';

function buildAttention() {
  const baseline = runSyntheticMicrogrid({ schemaVersion: 1, snapshotId: 'attention-fingerprint-snapshot', observedAt: '2026-01-01T00:00:00Z', assets: [{ id: 'load-1', kind: 'load', powerKw: 10 }, { id: 'solar-1', kind: 'solar', powerKw: 12, capacityKw: 15 }], topology: { nodes: ['node-load', 'node-solar'], connections: [{ assetId: 'load-1', nodeId: 'node-load' }, { assetId: 'solar-1', nodeId: 'node-solar' }] } });
  const candidate = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId, proposal: baseline.proposal };
  const provenanceRef = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId };
  const evidence = createSolvaerCollaborationEvidence({ request: baseline.solvaerRequest, candidate, provenanceRef });
  const decision = evaluateSolvaerDecisionHandoff({ request: baseline.solvaerRequest, candidate, provenanceRef, twinState: baseline.twinState, forecast: baseline.forecast, proposal: baseline.proposal });
  return buildSolvaerOperatorAttention({ evidence, decision });
}

test('fingerprints a validated operator attention artifact', () => { const attention = buildAttention(); assert.equal(attention.version, 2); assert.match(attention.attentionFingerprint, /^[a-f0-9]{64}$/); assert.equal(validateSolvaerOperatorAttention(attention), true); });
test('rejects a tampered operator attention artifact', () => { const attention = buildAttention(); const tampered = { ...attention, items: attention.items.map((item) => ({ ...item, priority: item.priority + 1 })) }; assert.equal(validateSolvaerOperatorAttention(tampered), false); });
