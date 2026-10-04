import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('ÆTHERGRID local secret files are ignored while templates stay trackable', async () => {
  const gitignore = await readFile(new URL('.gitignore', root), 'utf8');

  assert.match(gitignore, /^\.env\.secrets$/mu);
  assert.match(gitignore, /^\*\*\/\.env\.secrets$/mu);
  assert.match(gitignore, /^secrets\.env$/mu);
  assert.match(gitignore, /^!\.env\.secrets\.example$/mu);
});

test('tracked ÆTHERGRID secret manifest contains names only', async () => {
  const example = await readFile(
    new URL('apps/aethergrid-console/.env.secrets.example', root),
    'utf8',
  );

  for (const line of example.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    assert.match(trimmed, /^[A-Z0-9_]+=$/u);
  }

  assert.doesNotMatch(example, /gsk_[A-Za-z0-9]/u);
  assert.doesNotMatch(example, /iwa_live_/u);
  assert.doesNotMatch(example, /eyJhbGciOi/u);
});
