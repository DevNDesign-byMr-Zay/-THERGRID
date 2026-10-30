import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('test discovery includes arbitrary nesting and excludes dependencies, links and non-tests', async () => {
  const { discoverTests } = await import('../scripts/lib/test-discovery.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'aethergrid-discovery-'));
  try {
    for (const folder of ['nested/deep', 'node_modules/vendor']) {
      await mkdir(join(directory, folder), { recursive: true });
    }
    for (const file of [
      'z.test.mjs',
      'nested/deep/a.test.mjs',
      'node_modules/vendor/ignored.test.mjs',
      'not-a-test.mjs',
    ]) {
      await writeFile(join(directory, file), '');
    }
    if (process.platform !== 'win32') {
      await symlink(join(directory, 'nested'), join(directory, 'linked'));
    }
    assert.deepEqual(await discoverTests(directory), [
      join(directory, 'nested/deep/a.test.mjs'),
      join(directory, 'z.test.mjs'),
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('test discovery fails loudly when no maintained tests exist', async () => {
  const { discoverTests } = await import('../scripts/lib/test-discovery.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'aethergrid-empty-suite-'));
  try {
    await assert.rejects(discoverTests(directory), /No maintained Node test files discovered/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
