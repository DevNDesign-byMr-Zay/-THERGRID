import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);
async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 GTFS transit adapter consumes decoded vehicle positions without inventing routes', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/gtfs-transit.ts');

  assert.match(service, /\/api\/aethergrid\/transit\/vehicles/u);
  assert.match(service, /GTFS-Realtime Live/u);
  assert.match(service, /feedHeaderTimestamp/u);
  assert.match(service, /kind: 'transit'/u);
  assert.match(service, /eventType: 'gtfs-vehicle'/u);
  assert.match(service, /latitude/u);
  assert.match(service, /longitude/u);
  assert.match(service, /bearing/u);
  assert.match(service, /speedMps/u);
  assert.match(service, /MAX_TRANSIT_VEHICLES = 2_000/u);
  assert.doesNotMatch(service, /Math\.random|route geometry|interpolat/u);
});

test('v4 GTFS transit adapter withholds scene nodes for fallback or undecoded responses', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/gtfs-transit.ts');

  assert.match(service, /const sourceBacked = live \|\| stale/u);
  assert.match(service, /const nodes: SpatialOverlayNode\[\] = sourceBacked/u);
  assert.match(service, /fallback/u);
  assert.match(service, /unconfigured/u);
  assert.match(service, /stale/u);
});

test('v4 GTFS vehicles are live-only scene overlays in both renderers', async () => {
  const [app, badges, cesium, nativeRenderer, presets, styles, palette, composition] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/components/LiveSceneBadges.tsx'),
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
    text('apps/aethergrid-console/web/src/app/use-case-presets.ts'),
    text('apps/aethergrid-console/web/src/app/app.css'),
    text('apps/aethergrid-console/web/src/renderer/overlays/color-mapping.ts'),
    text('apps/aethergrid-console/web/src/app/spatial-overlay-composition.ts'),
  ]);

  assert.match(app, /loadGtfsTransit/u);
  assert.match(app, /globalThis\.setInterval\(refresh, 30_000\)/u);
  assert.match(app, /temporal\.mode !== 'live'/u);
  assert.match(composition, /!transitContext\.fallback/u);
  assert.match(composition, /!transitContext\.unconfigured/u);
  assert.match(app, /transitOverlay/u);
  assert.match(app, /<LiveSceneBadges/u);
  assert.match(badges, /GTFS-RT TRANSIT/u);
  assert.match(badges, /SOURCE-BACKED POSITIONS/u);
  assert.match(app, /vehicleCount/u);
  assert.match(cesium, /nodeColor/u);
  assert.match(palette, /gtfs-vehicle/u);
  assert.match(nativeRenderer, /gtfs-vehicle/u);
  assert.match(presets, /'transit'/u);
  assert.match(styles, /\.transit-scene-badge/u);
});
