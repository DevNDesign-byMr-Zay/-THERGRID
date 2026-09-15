import test from 'node:test';
import assert from 'node:assert/strict';
import { createSolvaerOperatorEvidenceSummary } from '../src/solvaer-operator-evidence-summary.mjs';
import {
  buildSolvaerOperatorAttentionFromSummary,
  validateSolvaerOperatorAttention,
} from '../src/solvaer-operator-attention.mjs';

function validAttention() {
  const summary = createSolvaerOperatorEvidenceSummary({
    snapshotId: 'snapshot-1',
    experimentId: 'experiment-1',
    simulationStatus: 'passed',
    receiptId: 'receipt-1',
    sceneId: 'scene-1',
    renderTarget: 'web-dashboard',
    provenanceValid: true,
    promotionStatus: 'simulation-only',
    authoritative: false,
    solvaerRequestId: 'request-1',
    collaborationEvidenceFingerprint: 'a'.repeat(64),
    simulationEvidenceFingerprint: 'b'.repeat(64),
    operatorProjectionFingerprint: 'c'.repeat(64),
    operatorProjectionValid: true,
    operatorInterpretation: 'operator-review-only',
    operatorResidualBalanceKw: 0,
    operatorGridAdjustmentKw: 0,
    operatorPromotionEligible: false,
    operatorAdvisoryOnly: true,
    operatorAuthoritative: false,
    operatorActuatesHardware: false,
  });
  return buildSolvaerOperatorAttentionFromSummary(summary);
}

test('accepts a complete sealed operator attention identity', () => {
  const attention = validAttention();
  assert.match(attention.attentionFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(validateSolvaerOperatorAttention(attention), true);
});

test('rejects missing experiment, snapshot, request, or evidence identity', () => {
  const base = validAttention();
  for (const field of ['experimentId', 'snapshotId', 'requestId']) {
    const candidate = { ...base, [field]: '' };
    assert.equal(validateSolvaerOperatorAttention(candidate), false, field);
  }
  assert.equal(
    validateSolvaerOperatorAttention({
      ...base,
      items: [
        { ...base.items[0], evidenceRef: '' },
        base.items[1],
      ],
    }),
    false,
  );
});

test('rejects unsafe attention state and stale fingerprints', () => {
  const base = validAttention();
  assert.equal(
    validateSolvaerOperatorAttention({
      ...base,
      safety: { ...base.safety, authoritative: true },
    }),
    false,
  );
  assert.equal(
    validateSolvaerOperatorAttention({
      ...base,
      safety: { ...base.safety, actuatesHardware: true },
    }),
    false,
  );
  assert.equal(
    validateSolvaerOperatorAttention({ ...base, attentionFingerprint: '0'.repeat(64) }),
    false,
  );
});
