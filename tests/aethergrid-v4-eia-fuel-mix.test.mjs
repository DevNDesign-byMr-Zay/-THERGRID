import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);
async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 EIA operational snapshot preserves provider rows units and nullable values', async () => {
  const client = await text('apps/aethergrid-console/web/src/services/operational-data-client.ts');

  assert.match(client, /OperationalFuelMixRow/u);
  assert.match(client, /fuelTypeDescription/u);
  assert.match(client, /sourceUnits/u);
  assert.match(client, /value: finite\(record\.value\)/u);
  assert.match(client, /fuelMix/u);
  assert.doesNotMatch(client, /value:\s*finite\(record\.value\)\s*\?\?\s*0/u);
});

test('v4 EIA panel shows only source-backed latest-period fuel records', async () => {
  const panel = await text('apps/aethergrid-console/web/src/components/OperationalDataPanel.tsx');

  assert.match(panel, /latestFuelMixRows/u);
  assert.match(panel, /source\?\.state !== 'live' && source\?\.state !== 'stale'/u);
  assert.match(panel, /row\.period === latestPeriod/u);
  assert.match(panel, /row\.value != null/u);
  assert.match(panel, /LATEST EIA FUEL MIX/u);
  assert.match(panel, /SOURCE VALUES · NOT A GEOGRAPHIC REGION POLYGON/u);
  assert.match(panel, /row\.sourceUnits/u);
});

test('v4 EIA fuel mix remains a panel visualization rather than invented spatial geometry', async () => {
  const [panel, app, styles] = await Promise.all([
    text('apps/aethergrid-console/web/src/components/OperationalDataPanel.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/app/app.css'),
  ]);

  assert.match(panel, /EnergyFuelMix/u);
  assert.match(styles, /\.eia-fuel-mix/u);
  assert.doesNotMatch(app, /eia-region-boundary|eia-region-polygon|fuel-mix-polygon/u);
});
