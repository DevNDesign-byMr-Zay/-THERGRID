import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 operational temporal capability registry refuses to replay current-only data', async () => {
  const capabilities = await text(
    'apps/aethergrid-console/web/src/time/operational-temporal-capabilities.ts',
  );

  assert.match(capabilities, /OperationalSourceId/u);
  assert.match(capabilities, /'weather'/u);
  assert.match(capabilities, /'hazards'/u);
  assert.match(capabilities, /'hydrology'/u);
  assert.match(capabilities, /'energy'/u);
  assert.match(capabilities, /'transit'/u);
  assert.match(capabilities, /'air-quality'/u);
  assert.match(capabilities, /'seismic'/u);
  assert.match(capabilities, /historical: 'current-only'/u);
  assert.match(capabilities, /forecast: 'current-only'/u);
  assert.match(capabilities, /forecast: 'available'/u);
  assert.match(capabilities, /pending-provider/u);
});

test('v4 operational client uses provider receipts and withholds fallback metrics', async () => {
  const client = await text('apps/aethergrid-console/web/src/services/operational-data-client.ts');

  assert.match(client, /receiptFrom/u);
  assert.match(client, /state === 'live' \|\| state === 'stale' \? metrics : \[\]/u);
  assert.match(client, /Fallback response present; operational metrics withheld/u);
  assert.match(client, /if \(input\.temporalMode !== 'live'\)/u);
  assert.match(client, /No provider-backed sample is connected to this non-LIVE cursor/u);
  assert.match(client, /loadHydrologyGauge/u);
  assert.match(client, /A source-backed gauge identifier is required/u);
  assert.match(client, /loadEnergyContextForRegion/u);
  assert.match(client, /A source-backed energy region is required/u);
  assert.match(client, /Bind an explicit NOAA NWPS gauge ID/u);
  assert.match(client, /Bind an explicit EIA balancing-region code/u);
  assert.match(client, /\/api\/aethergrid\/weather\/current/u);
  assert.match(client, /\/api\/aethergrid\/hazards\/alerts/u);
  assert.match(client, /\/api\/aethergrid\/hydrology\/gauges/u);
  assert.match(client, /\/api\/aethergrid\/energy\/context/u);
  assert.match(client, /\/api\/aethergrid\/transit\/vehicles/u);
  assert.doesNotMatch(client, /AETHERGRID_[A-Z0-9_]*(?:KEY|TOKEN|SECRET)/u);
});

test('v4 OPS workspace exposes source readiness without synthetic telemetry', async () => {
  const [panel, app, css] = await Promise.all([
    text('apps/aethergrid-console/web/src/components/OperationalDataPanel.tsx'),
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/app/app.css'),
  ]);

  assert.match(panel, /OPERATIONAL DATA/u);
  assert.match(panel, /Missing providers stay missing/u);
  assert.match(panel, /NO SYNTHETIC TELEMETRY/u);
  assert.match(panel, /temporalSupportFor/u);
  assert.match(panel, /existingSourceSnapshot/u);
  assert.match(panel, /sampleKey = temporalMode === 'live' \? 'live' : cursorIso/u);
  assert.match(app, /\['operations', 'OPS'\]/u);
  assert.match(app, /className="intel-workspace intel-operations"/u);
  assert.match(app, /<OperationalDataPanel/u);
  assert.match(app, /weatherCurrent=/u);
  assert.match(app, /airQualityCurrent=/u);
  assert.match(app, /seismicCurrent=/u);
  assert.match(app, /temporalMode=\{temporal\.mode\}/u);
  assert.match(app, /cursorIso=\{temporal\.cursorIso\}/u);
  assert.match(panel, /SOURCE BINDINGS/u);
  assert.match(panel, /APPLY BINDINGS/u);
  assert.match(panel, /never inferred from the map/u);
  assert.match(panel, /gaugeId: bindings\.gaugeId/u);
  assert.match(panel, /energyRegion: bindings\.energyRegion/u);
  assert.match(css, /data-workspace='operations'/u);
  assert.match(css, /data-provider-state='live'/u);
  assert.match(css, /data-provider-state='forecast'/u);
  assert.match(css, /data-provider-state='pending-provider'/u);
});
