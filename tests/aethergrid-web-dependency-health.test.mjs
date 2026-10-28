import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const web = new URL('../apps/aethergrid-console/web/', import.meta.url);

function atLeast(actual, minimum) {
  const numbers = (version) => version.split('.').map(Number);
  const candidate = numbers(actual);
  const floor = numbers(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (candidate[index] !== floor[index]) return candidate[index] > floor[index];
  }
  return true;
}

test('web lockfile is pinned above known Vite and DOMPurify advisory floors', async () => {
  const manifest = JSON.parse(await readFile(new URL('package.json', web), 'utf8'));
  const lock = JSON.parse(await readFile(new URL('package-lock.json', web), 'utf8'));
  const vite = lock.packages['node_modules/vite'].version;
  const dompurify = lock.packages['node_modules/dompurify'].version;

  assert.equal(manifest.devDependencies.vite, vite, 'Vite dependency must be exact and locked');
  assert.ok(atLeast(vite, '8.3.5'), `unpatched Vite: ${vite}`);
  assert.ok(atLeast(dompurify, '3.4.17'), `unpatched DOMPurify: ${dompurify}`);
});
