import { mkdir, writeFile } from 'node:fs/promises';

const commit = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/u.test(commit || '')) {
  throw new TypeError('canonical failure evidence requires an exact 40-character commit SHA');
}

function checkedOutcome(key) {
  const value = process.env[key] || 'not-run';
  if (!['success', 'failure', 'skipped', 'cancelled', 'not-run'].includes(value)) {
    throw new TypeError('unexpected canonical step outcome');
  }
  return value;
}

const browser = checkedOutcome('AETHERGRID_BROWSER_OUTCOME');
const credentialed = checkedOutcome('AETHERGRID_PROVIDER_OUTCOME');
if (browser === 'success' && credentialed === 'success') {
  throw new Error('do not create failure evidence for a successful canonical run');
}

// The only dynamic values are the workflow's SHA and allowlisted step outcomes.
// Do not include raw Playwright logs, errors, provider payloads or environment values.
const diagnostic = {
  schemaVersion: 1,
  artifactKind: 'failure-diagnostic',
  canonical: true,
  commit,
  generatedAt: new Date().toISOString(),
  passed: false,
  releaseEligible: false,
  gates: { browser, credentialed },
  providerAcceptanceExecuted: ['success', 'failure'].includes(credentialed),
  providerReceiptsVerified: false,
  hardwareSubmitted: false,
  hardwareExecuted: false,
};

await mkdir('canonical-evidence', { recursive: true });
await writeFile(
  'canonical-evidence/failure.json',
  `${JSON.stringify(diagnostic, null, 2)}\n`,
  'utf8',
);
process.stdout.write('Recorded non-authoritative, credential-free failure diagnostic.\n');
