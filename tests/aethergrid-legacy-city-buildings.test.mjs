import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const root = new URL('../apps/aethergrid-console/', import.meta.url);
const plain = (value) => JSON.parse(JSON.stringify(value));
async function builder() {
  const context = {};
  for (const file of ['spatial-math.js', 'legacy-city-buildings.js']) {
    runInNewContext(await readFile(new URL(file, root), 'utf8'), context);
  }
  assert.ok(Object.isFrozen(context.AETHERGRID_CITY_BUILDINGS));
  return context.AETHERGRID_CITY_BUILDINGS.buildCityBuildings;
}
const square = [
  [0, 0],
  [20, 0],
  [20, 20],
  [0, 20],
  [0, 0],
];
const building = (overrides = {}) => ({
  id: 'source-tower',
  name: 'Source tower',
  footprint: square,
  heightM: 100,
  minHeightM: 10,
  roofHeightM: 20,
  roofShape: 'pyramidal',
  buildingMaterial: 'glass',
  heightSource: 'osm-height',
  osmId: '123',
  osmType: 'way',
  startDate: '1920',
  ...overrides,
});
const options = { scale: 0.01, terrainSurfaceYAtSource: () => 0.2 };
const positions = (array) =>
  Array.from({ length: array.length / 4 }, (_, i) => array.slice(i * 4, i * 4 + 3));

test('city building boundary preserves source identity, terrain foundation, apex, lights and input', async () => {
  const build = await builder();
  const mesh = { buildings: [building()] };
  const before = structuredClone(mesh);
  const calls = [];
  const result = plain(
    build(mesh, {
      ...options,
      terrainSurfaceYAtSource(x, z) {
        calls.push([x, z]);
        return 0.2;
      },
    }),
  );
  assert.deepEqual(mesh, before);
  assert.deepEqual(calls, [[10, 10]]);
  assert.deepEqual(result.cityCenters, [[0.1, 0.1]]);
  assert.deepEqual(
    result.buildings.slice(0, 8),
    [0, 0.30000000000000004, 0, 0, 0.2, 0.30000000000000004, 0, 0.3],
  );
  assert.equal(result.buildingFaces.length / 4, 24);
  assert.equal(result.materialGlassFaces.length / 4, 24);
  assert.equal(result.roofFaces.length / 4, 12);
  assert.equal(result.roofLines.length / 4, 8);
  assert.deepEqual(result.roofFaces.slice(8, 12), [0.1, 1.2, 0.1, 0.48]);
  assert.equal(result.cityLights.length / 4, 2);
  assert.equal(result.graphNodes.length, 1);
  assert.equal(result.graphNodes[0].id, 'source-tower');
  assert.equal(result.graphNodes[0].osmId, '123');
  assert.equal(result.graphNodes[0].osmType, 'way');
  assert.equal(result.graphNodes[0].heightSource, 'osm-height');
  assert.deepEqual(result.graphNodes[0].position, [0.1, 1.28, 0.1]);
  assert.equal(result.landmarks[0].startDate, '1920');
  assert.deepEqual(result.landmarks[0].position, [0.1, 1.3399999999999999, 0.1]);
  assert.equal(result.landmarkSpines.length / 4, 2);
});

test('closed/open rings agree, invalid footprints emit nothing, flat roofs and material precedence stay intact', async () => {
  const build = await builder();
  const closed = building({ roofShape: 'flat', buildingMaterial: 'brick glass' });
  assert.deepEqual(
    plain(build({ buildings: [closed] }, options)),
    plain(build({ buildings: [{ ...closed, footprint: square.slice(0, -1) }] }, options)),
  );
  const result = plain(
    build(
      {
        buildings: [
          closed,
          building({
            footprint: [
              [0, 0],
              [1, 1],
            ],
          }),
        ],
      },
      options,
    ),
  );
  assert.equal(result.roofLines.length, 0);
  assert.ok(positions(result.roofFaces).every((point) => point[1] === 1.2));
  assert.equal(result.materialGlassFaces.length / 4, 24);
  assert.equal(result.materialMasonryFaces.length, 0);
  assert.equal(result.cityCenters.length, 1);
  for (const [material, target] of [
    ['brick', 'materialMasonryFaces'],
    ['steel', 'materialMetalFaces'],
    ['wood', 'materialNaturalFaces'],
  ]) {
    const materialResult = build(
      { buildings: [building({ buildingMaterial: material })] },
      options,
    );
    assert.equal(materialResult[target].length / 4, 24);
  }
  const empty = build({ buildings: [building({ footprint: [] })] }, options);
  assert.ok(Object.values(empty).every((array) => array.length === 0));
});

test('landmark ranking is stable, capped, source-qualified and deduplicates selection IDs', async () => {
  const build = await builder();
  const buildings = Array.from({ length: 24 }, (_, i) =>
    building({ id: `b${i}`, heightM: 90 + i }),
  );
  const result = plain(build({ buildings }, options));
  assert.equal(result.landmarks.length, 18);
  assert.deepEqual(
    result.landmarks.map((node) => node.id),
    Array.from({ length: 18 }, (_, i) => `b${23 - i}`),
  );
  assert.equal(result.graphNodes.length, 24);
  assert.equal(new Set(result.graphNodes.map((node) => node.id)).size, 24);
  const ties = plain(build({ buildings: [building({ id: 'a' }), building({ id: 'b' })] }, options));
  assert.deepEqual(
    ties.landmarks.map((node) => node.id),
    ['a', 'b'],
  );
  const source = plain(
    build(
      {
        buildings: [
          building({ id: 'inferred', name: '', heightSource: 'inferred' }),
          building({ id: 'synthetic', name: '', heightSource: 'synthetic-fallback' }),
          building({ id: 'source', name: '' }),
        ],
        skylineProfile: { p95HeightM: 100 },
      },
      options,
    ),
  );
  assert.deepEqual(
    source.landmarks.map((node) => node.id),
    ['source'],
  );
  assert.deepEqual(
    source.graphNodes.map((node) => node.id),
    ['inferred', 'source'],
  );
  assert.equal(source.graphNodes[1].type, 'landmark-building');
});

test('release readiness rejects missing building companions and missing inline packaging', async () => {
  const { verifyBackendReadiness } = await import('../scripts/lib/backend-readiness.mjs');
  const repo = new URL('../', import.meta.url);
  const read = (path) => readFile(new URL(path, repo), 'utf8');
  const pkg = JSON.parse(await read('package.json'));
  const html = await read('apps/aethergrid-console/index.html');
  await verifyBackendReadiness(read, assert.ok, pkg, html);
  await assert.rejects(
    verifyBackendReadiness(
      (path) =>
        path.endsWith('/legacy-city-buildings.js')
          ? Promise.reject(new Error('missing companion'))
          : read(path),
      assert.ok,
      pkg,
      html,
    ),
    /missing companion/u,
  );
  await assert.rejects(
    verifyBackendReadiness(
      async (path) => {
        const source = await read(path);
        return path.endsWith('assemble-aethergrid-full-app.mjs')
          ? source.replace(
              "legacySource.get('legacy-city-buildings.js')",
              "legacySource.get('missing.js')",
            )
          : source;
      },
      assert.ok,
      pkg,
      html,
    ),
    /must load after math/u,
  );
  await assert.rejects(
    verifyBackendReadiness(
      read,
      assert.ok,
      pkg,
      html.replace('<script src="./legacy-city-buildings.js" defer></script>', ''),
    ),
    /must load after math/u,
  );
  await assert.rejects(
    verifyBackendReadiness(
      read,
      assert.ok,
      pkg,
      html.replace('<script src="./spatial-math.js" defer></script>', ''),
    ),
    /must load after math/u,
  );
});
