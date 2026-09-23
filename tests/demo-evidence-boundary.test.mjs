import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const demoPath = fileURLToPath(new URL('../scripts/demo.mjs', import.meta.url));
const expectedPackageKeys = [
  'attention',
  'experimentId',
  'interpretation',
  'manifest',
  'packageFingerprint',
  'provenance',
  'readModel',
  'requestId',
  'safety',
  'snapshotId',
  'version',
].sort();
const expectedManifestKeys = [
  'attentionFingerprint',
  'provenanceFingerprint',
  'provenanceNodeId',
  'viewFingerprint',
].sort();
const expectedSafetyKeys = [
  'actuatesHardware',
  'advisoryOnly',
  'authoritative',
  'deploysInfrastructure',
  'dispatchesInfrastructure',
  'promotionEligible',
].sort();

function runDemo() {
  const result = spawnSync(process.execPath, [demoPath], {
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('demo emits an allowlisted sealed operator evidence package with no control payloads', () => {
  const evidencePackage = runDemo();

  assert.deepEqual(Object.keys(evidencePackage).sort(), expectedPackageKeys);
  assert.deepEqual(Object.keys(evidencePackage.manifest).sort(), expectedManifestKeys);
  assert.deepEqual(Object.keys(evidencePackage.safety).sort(), expectedSafetyKeys);
  assert.equal(evidencePackage.version, 1);
  assert.equal(evidencePackage.interpretation, 'operator-evidence-package-read-only');
  assert.equal(evidencePackage.safety.advisoryOnly, true);
  assert.equal(evidencePackage.safety.authoritative, false);
  assert.equal(evidencePackage.safety.actuatesHardware, false);
  assert.equal(evidencePackage.safety.promotionEligible, false);
  assert.equal(evidencePackage.safety.dispatchesInfrastructure, false);
  assert.equal(evidencePackage.safety.deploysInfrastructure, false);
  assert.match(evidencePackage.manifest.attentionFingerprint, /^[a-f0-9]{64}$/);
  assert.match(evidencePackage.manifest.provenanceFingerprint, /^[a-f0-9]{64}$/);
  assert.match(evidencePackage.manifest.viewFingerprint, /^[a-f0-9]{64}$/);
  assert.match(evidencePackage.packageFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(
    evidencePackage.manifest.attentionFingerprint,
    evidencePackage.attention.attentionFingerprint,
  );
  assert.equal(
    evidencePackage.manifest.provenanceNodeId,
    evidencePackage.readModel.provenanceNodeId,
  );
  assert.equal(evidencePackage.manifest.viewFingerprint, evidencePackage.readModel.viewFingerprint);

  const serialized = JSON.stringify(evidencePackage).toLowerCase();
  for (const forbidden of ['controlcommand', 'actionpayload']) {
    assert.equal(serialized.includes(forbidden), false, `demo package leaked ${forbidden}`);
  }
});

test('demo package fingerprint and complete output are deterministic across repeated runs', () => {
  const firstPackage = runDemo();
  const secondPackage = runDemo();

  assert.equal(firstPackage.packageFingerprint, secondPackage.packageFingerprint);
  assert.deepEqual(firstPackage, secondPackage);
});

test('demo package keeps operator authority closed at every exposed read layer', () => {
  const evidencePackage = runDemo();

  assert.equal(evidencePackage.attention.safety.authoritative, false);
  assert.equal(evidencePackage.attention.safety.actuatesHardware, false);
  assert.equal(evidencePackage.attention.safety.advisoryOnly, true);
  assert.equal(evidencePackage.readModel.safety.authoritative, false);
  assert.equal(evidencePackage.readModel.safety.actuatesHardware, false);
  assert.equal(evidencePackage.readModel.safety.advisoryOnly, true);
  assert.equal(evidencePackage.readModel.safety.promotionEligible, false);
  assert.equal(
    evidencePackage.provenance.nodes.filter((node) => node.type === 'operator-attention').length,
    1,
  );
});
