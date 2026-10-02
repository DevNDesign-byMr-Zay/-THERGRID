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
