import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateOperatorEvidencePackage } from '../src/operator-evidence-package.mjs';

const demoPath = fileURLToPath(new URL('../scripts/demo.mjs', import.meta.url));

function serializedDemoPackage() {
  const result = spawnSync(process.execPath, [demoPath], {
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(JSON.stringify(JSON.parse(result.stdout)));
}

test('validates an operator evidence package after a full JSON round trip', () => {
  const evidencePackage = serializedDemoPackage();

  assert.equal(validateOperatorEvidencePackage(evidencePackage), true);
  assert.match(evidencePackage.packageFingerprint, /^[a-f0-9]{64}$/);
});

test('serialized package still rejects manifest and nested evidence substitution', () => {
  const evidencePackage = serializedDemoPackage();

  assert.equal(
    validateOperatorEvidencePackage({
      ...evidencePackage,
      manifest: {
        ...evidencePackage.manifest,
        viewFingerprint: '0'.repeat(64),
      },
    }),
    false,
  );

  assert.equal(
    validateOperatorEvidencePackage({
      ...evidencePackage,
      readModel: {
        ...evidencePackage.readModel,
        provenanceNodeId: 'operator-attention:substituted',
      },
    }),
    false,
  );
});
