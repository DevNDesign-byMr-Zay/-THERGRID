import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

test('demo emits an allowlisted operator evidence summary with no control payloads', () => {
  const result = spawnSync(process.execPath, [demoPath], {
    encoding: 'utf8',
    env: process.env,
  });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
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

  const { summaryFingerprint, ...body } = summary;
  assert.equal(summaryFingerprint, fingerprint(body));

  const serialized = JSON.stringify(summary).toLowerCase();
  for (const forbidden of ['candidate', 'dispatchdeltakw', 'controlcommand', 'actionpayload']) {
    assert.equal(serialized.includes(forbidden), false, `demo summary leaked ${forbidden}`);
  }
});

test('demo summary fingerprint is deterministic across repeated runs', () => {
  const first = spawnSync(process.execPath, [demoPath], { encoding: 'utf8', env: process.env });
  const second = spawnSync(process.execPath, [demoPath], { encoding: 'utf8', env: process.env });

  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);

  const firstSummary = JSON.parse(first.stdout);
  const secondSummary = JSON.parse(second.stdout);
  assert.equal(firstSummary.summaryFingerprint, secondSummary.summaryFingerprint);
  assert.deepEqual(firstSummary, secondSummary);
});
