import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { validateSolvaerCollaborationResult } from '../src/solvaer-collaboration-validator.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { evaluateSolvaerDecisionHandoff } from '../src/solvaer-decision-handoff.mjs';
import { buildSolvaerOperatorAttention, validateSolvaerOperatorAttention } from '../src/solvaer-operator-attention.mjs';

function makeSnapshot(snapshotId) {
  return { schemaVersion: 1, snapshotId, observedAt: '2026-01-01T00:00:00Z', assets: [{ id: 'load-1', kind: 'load', powerKw: 10 }, { id: 'solar-1', kind: 'solar', powerKw: 12, capacityKw: 15 }], topology: { nodes: ['node-load', 'node-solar'], connections: [{ assetId: 'load-1', nodeId: 'node-load' }, { assetId: 'solar-1', nodeId: 'node-solar' }] } };
}

test('operator attention is derived from validated SOLVÆR evidence', () => {
  const baseline = runSyntheticMicrogrid(makeSnapshot('attention-snapshot'));
  const candidate = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId, proposal: baseline.proposal };
  const provenanceRef = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId };
  assert.equal(validateSolvaerCollaborationResult({ request: baseline.solvaerRequest, candidate, provenanceRef }), true);
  const evidence = createSolvaerCollaborationEvidence({ request: baseline.solvaerRequest, candidate, provenanceRef });
  const decision = evaluateSolvaerDecisionHandoff({ request: baseline.solvaerRequest, candidate, provenanceRef, twinState: baseline.twinState, forecast: baseline.forecast, proposal: baseline.proposal });
  const attention = buildSolvaerOperatorAttention({ evidence, decision });
  assert.equal(validateSolvaerOperatorAttention(attention), true);
  assert.equal(attention.experimentId, baseline.experimentId);
  assert.equal(attention.safety.advisoryOnly, true);
  assert.equal(attention.safety.actuatesHardware, false);
});

test('operator attention rejects cross-experiment decision evidence', () => {
  const baseline = runSyntheticMicrogrid(makeSnapshot('attention-cross-snapshot'));
  const candidate = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId, proposal: baseline.proposal };
  const provenanceRef = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId };
  const evidence = createSolvaerCollaborationEvidence({ request: baseline.solvaerRequest, candidate, provenanceRef });
  const decision = evaluateSolvaerDecisionHandoff({ request: baseline.solvaerRequest, candidate, provenanceRef, twinState: baseline.twinState, forecast: baseline.forecast, proposal: baseline.proposal });
  assert.throws(() => buildSolvaerOperatorAttention({ evidence, decision: { ...decision, experimentId: 'wrong-experiment' } }), /experiment/);
});
