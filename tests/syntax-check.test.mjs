import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const checker = resolve('scripts/check-syntax.mjs');

async function withFixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'aethergrid-syntax-'));
  try {
    return await fn(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function check(directory) {
  return spawnSync(process.execPath, [checker, directory], { encoding: 'utf8' });
}

test('portable syntax verifier finds valid nested JavaScript and ESM', async () =>
  withFixture(async (directory) => {
    await mkdir(join(directory, 'nested'));
    await writeFile(join(directory, 'nested', 'module.mjs'), 'export const answer = 42;\n');
    await writeFile(join(directory, 'nested', 'app.js'), 'const valid = true;\n');
    const result = check(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /2 files checked/u);
  }));

test('portable syntax verifier fails and names invalid nested source', async () =>
  withFixture(async (directory) => {
    await mkdir(join(directory, 'nested'));
    await writeFile(join(directory, 'nested', 'broken.mjs'), 'export const = ;\n');
    const result = check(directory);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /broken\.mjs/u);
  }));

test('portable syntax verifier ignores generated and dependency directories', async () =>
  withFixture(async (directory) => {
    await mkdir(join(directory, 'dist'));
    await mkdir(join(directory, 'node_modules'));
    await writeFile(join(directory, 'dist', 'broken.js'), 'const = ;\n');
    await writeFile(join(directory, 'node_modules', 'broken.mjs'), 'const = ;\n');
    await writeFile(join(directory, 'clean.mjs'), 'export default true;\n');
    const result = check(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 files checked/u);
  }));
