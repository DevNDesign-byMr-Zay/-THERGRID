import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validateSolvaerOperatorEvidenceSummary } from '../src/solvaer-operator-evidence-summary.mjs';

const demoPath = fileURLToPath(new URL('../scripts/demo.mjs', import.meta.url));
const expectedKeys = [
  'authoritative',
  'collaborationEvidenceFingerprint',
  'experimentId',
  'operatorActuatesHardware',
  'operatorAdvisoryOnly',
  'operatorAuthoritative',
  'operatorGridAdjustmentKw',
  'operatorInterpretation',
  'operatorProjectionFingerprint',
  'operatorProjectionValid',
  'operatorPromotionEligible',
  'operatorResidualBalanceKw',
  'promotionStatus',
  'provenanceValid',
  'receiptId',
  'renderTarget',
  'sceneId',
  'simulationEvidenceFingerprint',
  'simulationStatus',
  'snapshotId',
  'solvaerRequestId',
  'summaryFingerprint',
].sort();

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function fingerprint(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)), 'utf8')
    .digest('hex');
}

function runDemo() {
  const result = spawnSync(process.execPath, [demoPath], {
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('demo emits an allowlisted operator evidence summary with no control payloads', () => {
  const summary = runDemo();

  assert.deepEqual(Object.keys(summary).sort(), expectedKeys);
  assert.equal(summary.provenanceValid, true);
  assert.equal(summary.operatorProjectionValid, true);
  assert.equal(summary.operatorPromotionEligible, false);
  assert.equal(summary.operatorAdvisoryOnly, true);
  assert.equal(summary.operatorAuthoritative, false);
  assert.equal(summary.operatorActuatesHardware, false);
  assert.match(summary.collaborationEvidenceFingerprint, /^[a-f0-9]{64}$/);
  assert.match(summary.simulationEvidenceFingerprint, /^[a-f0-9]{64}$/);
  assert.match(summary.operatorProjectionFingerprint, /^[a-f0-9]{64}$/);
  assert.match(summary.summaryFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(validateSolvaerOperatorEvidenceSummary(summary), true);

  const { summaryFingerprint, ...body } = summary;
  assert.equal(summaryFingerprint, fingerprint(body));

  const serialized = JSON.stringify(summary).toLowerCase();
  for (const forbidden of ['candidate', 'dispatchdeltakw', 'controlcommand', 'actionpayload']) {
    assert.equal(serialized.includes(forbidden), false, `demo summary leaked ${forbidden}`);
  }
});

test('demo summary fingerprint is deterministic across repeated runs', () => {
  const firstSummary = runDemo();
  const secondSummary = runDemo();

  assert.equal(firstSummary.summaryFingerprint, secondSummary.summaryFingerprint);
  assert.deepEqual(firstSummary, secondSummary);
});

test('operator summary contract rejects tampering, authority widening, and field insertion', () => {
  const summary = runDemo();

  assert.equal(
    validateSolvaerOperatorEvidenceSummary({
      ...summary,
      operatorResidualBalanceKw: summary.operatorResidualBalanceKw + 1,
    }),
    false,
  );
  assert.equal(
    validateSolvaerOperatorEvidenceSummary({
      ...summary,
      operatorPromotionEligible: true,
    }),
    false,
  );
  assert.equal(
    validateSolvaerOperatorEvidenceSummary({
      ...summary,
      operatorAuthoritative: true,
    }),
    false,
  );
  assert.equal(
    validateSolvaerOperatorEvidenceSummary({
      ...summary,
      candidate: { dispatchDeltaKw: 1 },
    }),
    false,
  );
});

test('operator summary validator rejects accessor-backed fingerprints without evaluating getters', () => {
  const summary = runDemo();
  let getterReads = 0;
  const deceptive = { ...summary };
  Object.defineProperty(deceptive, 'summaryFingerprint', {
    enumerable: true,
    get() {
      getterReads += 1;
      return summary.summaryFingerprint;
    },
  });

  assert.equal(validateSolvaerOperatorEvidenceSummary(deceptive), false);
  assert.equal(getterReads, 0);
});
