import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { validateSolvaerCollaborationResult } from '../src/solvaer-collaboration-validator.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { evaluateSolvaerDecisionHandoff } from '../src/solvaer-decision-handoff.mjs';
import { createSolvaerOperatorEvidenceSummary } from '../src/solvaer-operator-evidence-summary.mjs';
import {
  buildSolvaerOperatorAttention,
  buildSolvaerOperatorAttentionFromSummary,
  validateSolvaerOperatorAttention,
} from '../src/solvaer-operator-attention.mjs';

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

function operatorSummary() {
  return createSolvaerOperatorEvidenceSummary({
    snapshotId: 'summary-snapshot',
    experimentId: 'summary-experiment',
    simulationStatus: 'passed',
    receiptId: 'receipt-1',
    sceneId: 'scene-1',
    renderTarget: 'web-dashboard',
    provenanceValid: true,
    promotionStatus: 'simulation-only',
    authoritative: false,
    solvaerRequestId: 'solvaer:summary-experiment:summary-snapshot',
    collaborationEvidenceFingerprint: 'a'.repeat(64),
    simulationEvidenceFingerprint: 'b'.repeat(64),
    operatorProjectionFingerprint: 'c'.repeat(64),
    operatorProjectionValid: true,
    operatorInterpretation: 'operator-review-only',
    operatorResidualBalanceKw: -0.5,
    operatorGridAdjustmentKw: -1,
    operatorPromotionEligible: false,
    operatorAdvisoryOnly: true,
    operatorAuthoritative: false,
    operatorActuatesHardware: false,
  });
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

test('operator attention can consume only the validated allowlisted summary', () => {
  const summary = operatorSummary();
  const attention = buildSolvaerOperatorAttentionFromSummary(summary);

  assert.equal(validateSolvaerOperatorAttention(attention), true);
  assert.equal(attention.experimentId, summary.experimentId);
  assert.equal(attention.snapshotId, summary.snapshotId);
  assert.equal(attention.requestId, summary.solvaerRequestId);
  assert.equal(attention.items[0].evidenceRef, summary.summaryFingerprint);
  assert.equal(attention.items[1].evidenceRef, summary.summaryFingerprint);
  assert.equal(attention.safety.authoritative, false);
  assert.equal(attention.safety.actuatesHardware, false);
});

test('operator attention rejects tampered operator summaries before projection', () => {
  const summary = operatorSummary();

  assert.throws(
    () => buildSolvaerOperatorAttentionFromSummary({ ...summary, operatorAuthoritative: true }),
    /validated SOLVÆR operator evidence summary is required/,
  );
  assert.throws(
    () => buildSolvaerOperatorAttentionFromSummary({ ...summary, candidate: { dispatchDeltaKw: 1 } }),
    /validated SOLVÆR operator evidence summary is required/,
  );
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
