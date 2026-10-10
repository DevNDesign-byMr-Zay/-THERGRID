import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/write-canonical-failure-evidence.mjs', import.meta.url));

test('failed browser acceptance leaves truthful, sanitized evidence rather than an empty artifact', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'aethergrid-canonical-failure-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(join(cwd, 'canonical-evidence'));
  await writeFile(join(cwd, 'canonical-evidence', 'providers.json'), '{"verified":false}\n');
  const secret = 'example-should-never-appear-in-artifacts';
  const result = spawnSync(process.execPath, [script], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_SHA: 'a'.repeat(40),
      AETHERGRID_BROWSER_OUTCOME: 'failure',
      AETHERGRID_PROVIDER_OUTCOME: 'skipped',
      AETHERGRID_OPENAI_API_KEY: secret,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const reportText = await readFile(join(cwd, 'canonical-evidence', 'failure.json'), 'utf8');
  const report = JSON.parse(reportText);
  assert.equal(report.commit, 'a'.repeat(40));
  assert.equal(report.artifactKind, 'failure-diagnostic');
  assert.equal(report.canonical, true);
  assert.equal(report.passed, false);
  assert.equal(report.releaseEligible, false);
  assert.equal(report.providerAcceptanceExecuted, false);
  assert.equal(report.gates.browser, 'failure');
  assert.equal(report.gates.credentialed, 'skipped');
  assert.equal(report.hardwareSubmitted, false);
  assert.equal(report.hardwareExecuted, false);
  assert.doesNotMatch(reportText, /example-should-never-appear-in-artifacts/u);
  assert.equal(await readFile(join(cwd, 'canonical-evidence', 'providers.json'), 'utf8'), '{"verified":false}\n');
});

test('failed acceptance cannot claim evidence under an invalid submission commit', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'aethergrid-canonical-invalid-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [script], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_SHA: 'not-a-commit',
      AETHERGRID_BROWSER_OUTCOME: 'failure',
      AETHERGRID_PROVIDER_OUTCOME: 'skipped',
    },
  });
  assert.notEqual(result.status, 0);
  await assert.rejects(readFile(join(cwd, 'canonical-evidence', 'failure.json')));
});
