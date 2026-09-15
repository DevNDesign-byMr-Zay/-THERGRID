import test from 'node:test';
import assert from 'node:assert/strict';
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
].sort();

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

  const serialized = JSON.stringify(summary).toLowerCase();
  for (const forbidden of ['candidate', 'dispatchdeltakw', 'controlcommand', 'actionpayload']) {
    assert.equal(serialized.includes(forbidden), false, `demo summary leaked ${forbidden}`);
  }
});
