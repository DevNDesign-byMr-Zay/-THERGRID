import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('vNext domain registry accounts for the universal command-center domain catalog', async () => {
  const registry = await text(
    'apps/aethergrid-console/web/src/domains/domain-registry.ts',
  );

  for (const domain of [
    'aviation',
    'maritime',
    'mobility',
    'energy',
    'weather',
    'markets',
    'logistics',
    'manufacturing',
    'telecom',
    'cyber',
    'healthcare',
    'retail',
    'real-estate',
    'agriculture',
    'business-operations',
    'public-safety',
    'environmental',
    'space',
  ]) {
    assert.match(registry, new RegExp(`id: '${domain}'`, 'u'));
  }
});

test('vNext aviation state preserves same-provider history and excludes current aircraft outside live time', async () => {
  const aviation = await text(
    'apps/aethergrid-console/web/src/domains/aviation/aviation-domain.ts',
  );

  assert.match(aviation, /export function mergeAviationSnapshot/u);
  assert.match(aviation, /previous\.provider === incoming\.provider/u);
  assert.match(aviation, /history/u);
  assert.match(aviation, /temporalMode !== 'live'/u);
  assert.match(aviation, /return null/u);
});

test('vNext aviation relationship geometry requires source-backed relationships', async () => {
  const aviation = await text(
    'apps/aethergrid-console/web/src/domains/aviation/aviation-domain.ts',
  );

  assert.match(aviation, /relationship\.sourceBacked === true/u);
  assert.match(aviation, /kind: 'route'/u);
});

test('vNext aviation uses the canonical provider path and the existing Cesium overlay renderer', async () => {
  const [client, app, overlay, cesiumLayer] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/aviation-client.ts'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/renderer/overlays/spatial-overlay.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
  ]);

  assert.match(client, /\/api\/aethergrid\/domains\/aviation\/aircraft/u);
  assert.match(app, /aviationOverlay/u);
  assert.match(app, /id: 'aviation'/u);
  assert.match(overlay, /\| 'aircraft'/u);
  assert.match(cesiumLayer, /eventType === 'aircraft'/u);
  assert.match(cesiumLayer, /ModelGraphics/u);
  assert.match(cesiumLayer, /aethergrid-aircraft\.gltf/u);
});
