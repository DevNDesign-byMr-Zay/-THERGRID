import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { verifyAethergridPackageInventory } from '../scripts/lib/aethergrid-package-integrity.mjs';

const prefix = 'aethergrid-functional-app/';
const contents = {
  'server.mjs': 'export const server = "real";\n'.repeat(500),
  'web/dist/index.html':
    '<div id="root"></div><script type="module" src="/assets/app.js"></script>',
  'web/dist/assets/app.js': 'export const app = "real";\n'.repeat(5000),
  'web/dist/assets/app.css': 'body { color: #fff; }\n'.repeat(90),
  'web/dist/cesium/Workers/worker.js': 'self.onmessage = () => {}',
};

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'aethergrid-package-integrity-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const files = [];
  for (const [path, value] of Object.entries(contents).sort(([a], [b]) => a.localeCompare(b))) {
    const target = join(dir, ...path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, value);
    files.push({
      path,
      bytes: Buffer.byteLength(value),
      sha256: createHash('sha256').update(value).digest('hex'),
    });
  }
  const manifest = {
    schemaVersion: 2,
    canonicalWebApp: 'web/dist/index.html',
    backend: 'server.mjs',
    files,
  };
  await writeFile(join(dir, 'PACKAGE_CONTENTS.json'), JSON.stringify(manifest));
  await writeFile(
    join(dir, 'SHA256SUMS.txt'),
    files.map(({ sha256, path }) => sha256 + '  ' + path).join('\n') + '\n',
  );
  return {
    dir,
    entries: [
      ...files.map(({ path }) => prefix + path),
      prefix + 'PACKAGE_CONTENTS.json',
      prefix + 'SHA256SUMS.txt',
    ],
  };
}

test('shipped runtime validates every file digest and substantive frontend assets', async (t) => {
  const { dir, entries } = await fixture(t);
  const summary = await verifyAethergridPackageInventory(dir, entries);
  assert.equal(summary.verifiedFiles, Object.keys(contents).length);
  assert.equal(summary.javascriptAssets, 1);
  assert.equal(summary.cesiumWorkers, 1);
});

test('tampered payload cannot pass the declared ZIP SHA-256 inventory', async (t) => {
  const { dir, entries } = await fixture(t);
  await writeFile(join(dir, 'web/dist/assets/app.js'), 'a tiny placeholder');
  await assert.rejects(verifyAethergridPackageInventory(dir, entries));
});

test('missing or duplicate archive entries cannot masquerade as complete', async (t) => {
  const { dir, entries } = await fixture(t);
  await assert.rejects(verifyAethergridPackageInventory(dir, entries.slice(1)));
  await assert.rejects(verifyAethergridPackageInventory(dir, [...entries, entries[0]]));
});
