import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

await import('../apps/aethergrid-console/standalone-geo.js');

const { buildStandaloneCityMesh } = globalThis.AETHERGRID_STANDALONE_GEO;
const city = Object.freeze({
  id: 'new-york',
  name: 'New York',
  district: 'Midtown Manhattan',
  lat: 40.7549,
  lon: -73.984,
  radiusM: 1600,
});

test('browser-local fallback keeps source provenance and never claims measured city data', () => {
  const mesh = buildStandaloneCityMesh(city);
  assert.equal(mesh.schemaVersion, 4);
  assert.equal(mesh.source.live, false);
  assert.equal(mesh.source.provider, 'standalone-local-fallback');
  assert.match(mesh.source.attribution, /requires the Node backend/u);
  assert.equal(mesh.skylineProfile.live, false);
  assert.equal(mesh.skylineProfile.sourceBackedHeightCoveragePercent, 0);
  assert.equal(mesh.skylineProfile.upstreamTimestamp, null);
  assert.equal(mesh.environment.source.live, false);
  assert.equal(mesh.environment.current, null);
  assert.equal(mesh.liveContext.airQuality.source.live, false);
  assert.equal(mesh.liveContext.airQuality.current, null);
  assert.equal(mesh.liveContext.seismic.source.live, false);
  assert.deepEqual(mesh.liveContext.seismic.events, []);
  assert.equal(mesh.terrain.source.live, false);
});

test('synthetic fallback geometry is deterministic and bounded for the same city', () => {
  const first = buildStandaloneCityMesh(city, 8);
  const again = buildStandaloneCityMesh(city, 8);
  const elsewhere = buildStandaloneCityMesh({ ...city, id: 'london' }, 8);
  assert.deepEqual(first.buildings, again.buildings);
  assert.deepEqual(first.roads, again.roads);
  assert.deepEqual(first.powerAssets, again.powerAssets);
  assert.deepEqual(first.powerLines, again.powerLines);
  assert.notDeepEqual(first.buildings, elsewhere.buildings);
  assert.equal(first.buildings.length, 8);
  assert.equal(first.roads.length, 18);
  assert.equal(first.powerAssets.length, 8);
  assert.equal(first.powerLines.length, 8);
  for (const building of first.buildings) {
    assert.equal(building.heightSource, 'synthetic-fallback');
    assert.ok(building.heightM >= 9 && building.heightM <= 119);
    assert.deepEqual(building.footprint[0], building.footprint.at(-1));
    assert.ok(building.footprint.flat().every(Number.isFinite));
  }
});

test('standalone flat terrain is bounded with seven-by-seven local samples', () => {
  const terrain = buildStandaloneCityMesh(city, 8).terrain;
  assert.equal(terrain.gridSize, 7);
  assert.equal(terrain.points.length, 49);
  assert.equal(terrain.minElevationM, 0);
  assert.equal(terrain.maxElevationM, 0);
  assert.deepEqual(terrain.points[0], {
    x: -city.radiusM,
    z: -city.radiusM,
    elevationM: 0,
    relativeElevationM: 0,
  });
  assert.equal(terrain.points.at(-1).x, city.radiusM);
  assert.equal(terrain.points.at(-1).z, city.radiusM);
  assert.ok(terrain.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)));
});

test('legacy offline HTML loads and caches the extracted city module', async () => {
  const root = new URL('../apps/aethergrid-console/', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  const sw = await readFile(new URL('sw.js', root), 'utf8');
  const scripts = [
    '<script src="./state.js" defer></script>',
    '<script src="./standalone-geo.js" defer></script>',
    '<script src="./app.js" defer></script>',
  ];
  let previous = -1;
  for (const script of scripts) {
    const index = html.indexOf(script);
    assert.ok(index > previous, `Missing or out-of-order direct-open script: ${script}`);
    previous = index;
  }
  assert.match(sw, /\.\/standalone-geo\.js/u);
  assert.doesNotMatch(html, /type="module"/u);
});
