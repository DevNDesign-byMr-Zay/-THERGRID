import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = async (path) => readFile(new URL(path, root), 'utf8');

test('release metadata, lockfile and versioned notes describe the same patch candidate', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  const consoleManifest = JSON.parse(await read('apps/operator-console/app.json'));
  assert.equal(manifest.version, '0.3.6');
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[''].version, manifest.version);
  assert.equal(consoleManifest.version, manifest.version);
  const notes = await read(`docs/releases/v${manifest.version}.md`);
  assert.ok(notes.startsWith(`# ÆTHERGRID v${manifest.version}\n`));
  assert.match(notes, /Open Quantum discovery is read-only/u);
});
