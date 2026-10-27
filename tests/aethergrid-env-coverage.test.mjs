import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const application = new URL('apps/aethergrid-console/', root);

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
