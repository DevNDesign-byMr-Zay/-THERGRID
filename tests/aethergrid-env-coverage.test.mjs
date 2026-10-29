import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const application = new URL('apps/aethergrid-console/', root);
const runtimeKeyPattern = /\b(?:process\.)?env\.((?:AETHERGRID|GROQ)_[A-Z0-9_]+)\b/gu;

function parseKeys(text) {
  const keys = new Set();
  for (const line of text.split(/\r?\n/u)) {
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/u);
    assert.ok(match, `invalid environment template line: ${line}`);
    assert.ok(!keys.has(match[1]), `duplicate environment variable: ${match[1]}`);
    keys.add(match[1]);
  }
  return keys;
}

test('application template documents schema and optional runtime settings', async () => {
  const keys = parseKeys(await readFile(new URL('.env.example', application), 'utf8'));
  const schema = await readFile(new URL('config/env-schema.mjs', application), 'utf8');
  const schemaKeys = [...schema.matchAll(/^  (AETHERGRID_[A-Z0-9_]+):/gmu)].map(
    (match) => match[1],
  );
  const runtimeKeys = [
    'AETHERGRID_SETUP_PASSWORD',
    'AETHERGRID_NWS_URL',
    'AETHERGRID_PROVIDER_TIMEOUT_MS',
    'AETHERGRID_EIA_URL',
    'AETHERGRID_DWAVE_BASE_URL',
    'AETHERGRID_DWAVE_URL',
    'AETHERGRID_NO_BROWSER',
    'AETHERGRID_LAUNCH_DIAGNOSTICS',
  ];
  for (const key of [...schemaKeys, ...runtimeKeys]) {
    assert.ok(keys.has(key), `missing from application environment template: ${key}`);
  }
});

test('root environment template includes application configuration and leaves secrets blank', async () => {
  const app = await readFile(new URL('.env.example', application), 'utf8');
  const rootText = await readFile(new URL('.env.example', root), 'utf8');
  const appKeys = parseKeys(app);
  const rootKeys = parseKeys(rootText);
  for (const key of appKeys) {
    assert.ok(rootKeys.has(key), `missing from root environment template: ${key}`);
  }
  for (const template of [app, rootText]) {
    for (const line of template.split(/\r?\n/u)) {
      if (line.startsWith('#')) continue;
      if (/(?:API_KEY|TOKEN|SECRET|PASSWORD|_CRN|CLIENT_ID)=/u.test(line)) {
        assert.match(line, /^[A-Z][A-Z0-9_]*=$/u, `template secret must remain blank: ${line}`);
      }
    }
  }
});

const excludedDirectories = new Set([
  'node_modules',
  'web',
  'dist',
  'build',
  'coverage',
  'artifacts',
  'assets',
  'test-results',
]);

async function collectRuntimeSourceKeys(directory, found = new Map()) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && !excludedDirectories.has(entry.name)) {
        await collectRuntimeSourceKeys(new URL(`${entry.name}/`, directory), found);
      }
      continue;
    }
    if (!entry.isFile() || !/\.(?:mjs|js)$/u.test(entry.name)) continue;
    const file = new URL(entry.name, directory);
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(runtimeKeyPattern)) {
      if (!found.has(match[1])) found.set(match[1], file.pathname);
    }
  }
  return found;
}

test('runtime environment keys stay documented without credentials', async () => {
  const runtime = await collectRuntimeSourceKeys(application);
  for (const filename of [
    'aethergrid-live-provider-smoke.mjs',
    'aethergrid-canonical-provider-smoke.mjs',
  ]) {
    const file = new URL(`scripts/${filename}`, root);
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(runtimeKeyPattern)) {
      if (!runtime.has(match[1])) runtime.set(match[1], file.pathname);
    }
  }
  assert.ok(runtime.size > 50, 'runtime discovery unexpectedly omitted source modules');
  const [rootKeys, appKeys] = await Promise.all([
    readFile(new URL('.env.example', root), 'utf8').then(parseKeys),
    readFile(new URL('.env.example', application), 'utf8').then(parseKeys),
  ]);
  for (const [key, source] of runtime) {
    assert.ok(
      appKeys.has(key),
      `application template lacks ${key} (referenced in ${source})`,
    );
    assert.ok(
      rootKeys.has(key),
      `root template lacks ${key} (referenced in ${source})`,
    );
  }
});
