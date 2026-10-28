import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const scripts = new URL('../scripts/', import.meta.url);

test('offline runner works from paths containing spaces and removes provider credentials', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aethergrid offline with spaces '));
  try {
    await mkdir(join(root, 'scripts'));
    await mkdir(join(root, 'tests', 'js'), { recursive: true });
    await mkdir(join(root, 'tests', 'nested', 'deeper'), { recursive: true });
    for (const filename of ['run-offline-tests.mjs', 'guard-offline-network.mjs']) {
      await copyFile(new URL(filename, scripts), join(root, 'scripts', filename));
    }
    await writeFile(
      join(root, 'tests', 'credential.test.mjs'),
      `import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
test('environment is credential free', () => {
  for (const key of ['AETHERGRID_CESIUM_ION_TOKEN', 'GROQ_API_KEY', 'AETHERGRID_OPENAI_API_KEY', 'AETHERGRID_AUTH_USERS']) {
    assert.equal(process.env[key], undefined, key);
  }
  assert.equal(process.env.AETHERGRID_AI_PROVIDER, 'local');
  writeFileSync(${JSON.stringify(join(root, 'witness.txt'))}, 'executed');
});
`,
    );
    await writeFile(
      join(root, 'tests', 'nested', 'deeper', 'discovery.test.mjs'),
      `import test from 'node:test';
import { writeFileSync } from 'node:fs';
test('recursive discovery reaches nested suites', () => {
  writeFileSync(${JSON.stringify(join(root, 'nested-witness.txt'))}, 'executed');
});
`,
    );
    const childEnv = {
      ...process.env,
      AETHERGRID_CESIUM_ION_TOKEN: 'private-cesium-fixture',
      GROQ_API_KEY: 'private-groq-fixture',
      AETHERGRID_OPENAI_API_KEY: 'private-openai-fixture',
      AETHERGRID_AUTH_USERS: 'private-auth-fixture',
    };
    // A nested node --test must not inherit Node's own test-worker context.
    for (const key of Object.keys(childEnv)) {
      if (key.startsWith('NODE_TEST_')) delete childEnv[key];
    }
    const result = spawnSync(process.execPath, [join(root, 'scripts', 'run-offline-tests.mjs')], {
      encoding: 'utf8',
      env: childEnv,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr || result.error}`);
    const witness = await readFile(join(root, 'witness.txt'), 'utf8').catch(() => null);
    const nestedWitness = await readFile(join(root, 'nested-witness.txt'), 'utf8').catch(
      () => null,
    );
    assert.equal(witness, 'executed', `runner skipped tests: ${result.stdout}\n${result.stderr}`);
    assert.equal(
      nestedWitness,
      'executed',
      `runner skipped nested tests: ${result.stdout}\n${result.stderr}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
