import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const runner = fileURLToPath(new URL('../scripts/run-reported-tests.mjs', import.meta.url));

test('JUnit reporter preserves passing test results and native test names', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aethergrid-junit-pass-'));
  try {
    const file = join(directory, 'success.test.mjs');
    const report = join(directory, 'report.xml');
    await writeFile(file, "import test from 'node:test'; test('verified fixture', () => {});\n");
    const result = spawnSync(process.execPath, [runner, file], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, AETHERGRID_JUNIT_PATH: report },
    });
    assert.equal(result.status, 0, result.stderr);
    const xml = await readFile(report, 'utf8');
    assert.match(xml, /<testsuites>/u);
    assert.match(xml, /testcase name="verified fixture"/u);
    assert.doesNotMatch(xml, /<failure /u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('JUnit reporter records failures without turning red tests green', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aethergrid-junit-fail-'));
  try {
    const file = join(directory, 'failure.test.mjs');
    const report = join(directory, 'report.xml');
    await writeFile(
      file,
      "import test from 'node:test'; test('intentional failure', () => { throw Error('fixture failed'); });\n",
    );
    const result = spawnSync(process.execPath, [runner, file], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, AETHERGRID_JUNIT_PATH: report },
    });
    assert.notEqual(result.status, 0);
    const xml = await readFile(report, 'utf8');
    assert.match(xml, /testcase name="intentional failure"/u);
    assert.match(xml, /<failure /u);
    assert.match(xml, /fixture failed/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
