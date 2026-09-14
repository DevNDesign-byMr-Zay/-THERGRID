import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { validateSolvaerCollaborationResult } from '../src/solvaer-collaboration-validator.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { evaluateSolvaerDecisionHandoff } from '../src/solvaer-decision-handoff.mjs';
import { buildSolvaerOperatorAttention, validateSolvaerOperatorAttention } from '../src/solvaer-operator-attention.mjs';

function snapshot(snapshotId) {
  return {
    schemaVersion: 1,
    snapshotId,
    observedAt: '2026-01-01T00:00:00.000Z',
    assets: [
      { id: 'solar-1', kind: 'solar', powerKw: 12, capacityKw: 15 },
      { id: 'load-1', kind: 'load', powerKw: 10, flexible: true },
      { id: 'grid-1', kind: 'grid_interconnect', powerKw: -2, importLimitKw: 80, exportLimitKw: 40 },
    ],
    topology: {
      nodes: ['node-a'],
      connections: [
        { assetId: 'solar-1', nodeId: 'node-a' },
        { assetId: 'load-1', nodeId: 'node-a' },
        { assetId: 'grid-1', nodeId: 'node-a' },
      ],
    },
  };
}

test('operator attention is derived from validated SOLVÆR evidence', () => {
  const baseline = runSyntheticMicrogrid(snapshot('attention-snapshot'));
  const candidate = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId, proposal: baseline.proposal };
  const provenanceRef = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId };
  assert.equal(validateSolvaerCollaborationResult({ request: baseline.solvaerRequest, candidate, provenanceRef }), true);
  const evidence = createSolvaerCollaborationEvidence({ request: baseline.solvaerRequest, candidate, provenanceRef });
  const decision = evaluateSolvaerDecisionHandoff({ request: baseline.solvaerRequest, candidate, provenanceRef, twinState: baseline.twinState, forecast: baseline.forecast, proposal: baseline.proposal });
  const attention = buildSolvaerOperatorAttention({ evidence, decision });
  assert.equal(validateSolvaerOperatorAttention(attention), true);
  assert.equal(attention.requestId, baseline.solvaerRequest.requestId);
  assert.equal(attention.experimentId, baseline.experimentId);
  assert.equal(attention.safety.advisoryOnly, true);
  assert.equal(attention.safety.actuatesHardware, false);
});

test('operator attention rejects cross-experiment or cross-request decision evidence', () => {
  const baseline = runSyntheticMicrogrid(snapshot('attention-cross-snapshot'));
  const candidate = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId, proposal: baseline.proposal };
  const provenanceRef = { experimentId: baseline.experimentId, snapshotId: baseline.solvaerRequest.snapshotId };
  const evidence = createSolvaerCollaborationEvidence({ request: baseline.solvaerRequest, candidate, provenanceRef });
  const decision = evaluateSolvaerDecisionHandoff({ request: baseline.solvaerRequest, candidate, provenanceRef, twinState: baseline.twinState, forecast: baseline.forecast, proposal: baseline.proposal });
  assert.throws(() => buildSolvaerOperatorAttention({ evidence, decision: { ...decision, experimentId: 'wrong-experiment' } }), /experiment/);
  assert.throws(() => buildSolvaerOperatorAttention({ evidence, decision: { ...decision, requestId: 'wrong-request' } }), /requestId/);
});
