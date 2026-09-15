import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { validateSolvaerCollaborationResult } from '../src/solvaer-collaboration-validator.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { evaluateSolvaerDecisionHandoff } from '../src/solvaer-decision-handoff.mjs';
import { buildSolvaerOperatorAttention, validateSolvaerOperatorAttention } from '../src/solvaer-operator-attention.mjs';

test('operator attention is derived from validated SOLVÆR evidence', () => {
  const baseline = runSyntheticMicrogrid({ schemaVersion: 1, snapshotId: 'attention-snapshot', observedAt: '2026-01-01T00:00:00Z', nodes: [{ id: 'n1', loadKw: 10, generationKw: 12 }] });
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
  const baseline = runSyntheticMicrogrid({ schemaVersion: 1, snapshotId: 'attention-cross-snapshot', observedAt: '2026-01-01T00:00:00Z', nodes: [{ id: 'n1', loadKw: 10, generationKw: 12 }] });
  const candidate = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId, proposal: baseline.proposal };
  const provenanceRef = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId };
  const evidence = createSolvaerCollaborationEvidence({ request: baseline.solvaerRequest, candidate, provenanceRef });
  const decision = evaluateSolvaerDecisionHandoff({ request: baseline.solvaerRequest, candidate, provenanceRef, twinState: baseline.twinState, forecast: baseline.forecast, proposal: baseline.proposal });
  assert.throws(() => buildSolvaerOperatorAttention({ evidence, decision: { ...decision, experimentId: 'wrong-experiment' } }), /experiment/);
});
