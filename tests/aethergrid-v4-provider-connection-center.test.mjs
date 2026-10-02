import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 provider connection center consumes only safe runtime metadata', async () => {
  const [client, panel] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/runtime-client.ts'),
    text('apps/aethergrid-console/web/src/components/RuntimeDiagnosticsPanel.tsx'),
  ]);

  assert.match(client, /\/api\/aethergrid\/runtime\/providers/u);
  assert.match(client, /loadPublicProviderRuntime/u);
  assert.match(panel, /CONNECTION CENTER/u);
  assert.match(panel, /LIVE PROVIDER RUNTIME/u);
  assert.match(panel, /loadPublicProviderRuntime/u);
  assert.match(panel, /credentials remain server-side/i);
  assert.doesNotMatch(panel, /apiKey|authorization|bearer|tokenValue/u);
});

test('v4 provider connection center exposes the merged provider capability set', async () => {
  const panel = await text('apps/aethergrid-console/web/src/components/RuntimeDiagnosticsPanel.tsx');

  for (const capability of [
    'spatial',
    'geo',
    'terrain',
    'weather',
    'airQuality',
    'seismic',
    'hazards',
    'hydrology',
    'energy',
    'transit',
    'quantum',
    'ai',
  ]) {
    assert.match(panel, new RegExp(`id: '${capability}'`, 'u'));
  }

  assert.match(panel, /ready/u);
  assert.match(panel, /configured/u);
  assert.match(panel, /degraded/u);
  assert.match(panel, /fallback/u);
  assert.match(panel, /unavailable/u);
  assert.match(panel, /unconfigured/u);
});

test('v4 provider states receive dedicated operator styling', async () => {
  const styles = await text('apps/aethergrid-console/web/src/app/app.css');

  assert.match(styles, /\.provider-connection-center/u);
  assert.match(styles, /\.provider-connection-summary/u);
  assert.match(styles, /\.runtime-state\.configured/u);
  assert.match(styles, /\.runtime-state\.degraded/u);
  assert.match(styles, /\.runtime-state\.unavailable/u);
});
