import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 operational source bindings are explicit per-scope local operator settings', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operational-source-bindings.ts',
  );

  assert.match(service, /aethergrid\.operator\.operational-source-bindings\.v1/u);
  assert.match(service, /scopeId/u);
  assert.match(service, /normalizeGaugeId/u);
  assert.match(service, /normalizeEnergyRegion/u);
  assert.match(service, /saveOperationalSourceBindings/u);
  assert.match(service, /clearOperationalSourceBindings/u);
  assert.doesNotMatch(service, /API_KEY|TOKEN|SECRET/u);
  assert.doesNotMatch(service, /latitude|longitude|geocode/u);
});

test('v4 source bindings validate provider identifiers instead of guessing them from coordinates', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operational-source-bindings.ts',
  );

  assert.match(service, /\^\[A-Z0-9_-\]\{1,32\}\$/u);
  assert.match(service, /\^\[A-Z0-9_-\]\{2,20\}\$/u);
  assert.match(service, /NOAA gauge ID must use/u);
  assert.match(service, /EIA region code must use/u);
});

test('v4 bound hydrology and energy reads use existing backend routes only in live snapshots', async () => {
  const client = await text('apps/aethergrid-console/web/src/services/operational-data-client.ts');

  assert.match(client, /gaugeId\?: string \| null/u);
  assert.match(client, /energyRegion\?: string \| null/u);
  assert.match(client, /loadHydrologyGauge\(input\.gaugeId/u);
  assert.match(client, /loadEnergyContextForRegion\(input\.energyRegion/u);
  assert.match(client, /\/api\/aethergrid\/hydrology\/gauges/u);
  assert.match(client, /\/api\/aethergrid\/energy\/context/u);
  assert.match(client, /if \(input\.temporalMode !== 'live'\)/u);
});

test('v4 NOAA EIA and GTFS adapters expose provider-backed metrics without synthetic values', async () => {
  const client = await text(
    'apps/aethergrid-console/web/src/services/operational-data-client.ts',
  );

  assert.match(client, /observedStageFeet/u);
  assert.match(client, /observedFlowCfs/u);
  assert.match(client, /forecastStageFeet/u);
  assert.match(client, /minorFloodStageFeet/u);
  assert.match(client, /FUEL ROWS/u);
  assert.match(client, /GTFS-Realtime Live/u);
  assert.match(client, /feedHeaderTimestamp/u);
  assert.doesNotMatch(client, /Math\.random/u);
});

test('v4 source binding UI states that identifiers are operator selected and live only', async () => {
  const [panel, styles] = await Promise.all([
    text('apps/aethergrid-console/web/src/components/OperationalDataPanel.tsx'),
    text('apps/aethergrid-console/web/src/app/app.css'),
  ]);

  assert.match(panel, /OPERATOR SELECTED/u);
  assert.match(panel, /LIVE ONLY/u);
  assert.match(panel, /bindingScopeId/u);
  assert.match(panel, /latitude\.toFixed\(5\)/u);
  assert.match(panel, /longitude\.toFixed\(5\)/u);
  assert.match(panel, /NOAA NWPS GAUGE ID/u);
  assert.match(panel, /EIA REGION CODE/u);
  assert.match(panel, /Bind only identifiers you have verified/u);
  assert.match(styles, /\.operational-source-bindings/u);
  assert.match(styles, /\.source-binding-grid/u);
});
