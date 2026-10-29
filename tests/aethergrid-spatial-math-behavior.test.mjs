import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

await import('../apps/aethergrid-console/spatial-math.js');
const math = globalThis.AETHERGRID_SPATIAL_MATH;

test('camera projection matrices are finite and preserve identity', () => {
  const identity = Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const perspective = math.perspective(Math.PI / 2, 2, 1, 101);
  const orthographic = math.orthographic(-10, 10, -5, 5, 1, 101);
  assert.equal(perspective.length, 16);
  assert.equal(orthographic.length, 16);
  assert.ok(perspective.every(Number.isFinite));
  assert.ok(orthographic.every(Number.isFinite));
  assert.equal(perspective[11], -1);
  assert.equal(orthographic[15], 1);
  assert.deepEqual([...math.mat4Multiply(identity, perspective)], [...perspective]);
  const camera = math.lookAt([0, 0, 10], [0, 0, 0], [0, 1, 0]);
  assert.equal(camera[14], -10);
  assert.deepEqual([...math.mat4Multiply(identity, camera)], [...camera]);
});

test('bilinear terrain interpolation is bounded and degrades safely', () => {
  const terrain = {
    gridSize: 2,
    radiusM: 10,
    points: [0, 10, 20, 30].map((relativeElevationM) => ({ relativeElevationM })),
  };
  assert.equal(math.bilinearTerrainElevation(terrain, 0, 0), 15);
  assert.equal(math.bilinearTerrainElevation(terrain, 10, 10), 30);
  assert.equal(math.bilinearTerrainElevation(terrain, -10, -10), 0);
  assert.equal(math.bilinearTerrainElevation(terrain, 500, 500), 30);
  assert.equal(math.bilinearTerrainElevation(null, 0, 0), 0);
  assert.equal(math.bilinearTerrainElevation(terrain, NaN, 0), 0);
});

test('direct-open compatibility loads each legacy helper before app.js', async () => {
  const root = new URL('../apps/aethergrid-console/', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  const worker = await readFile(new URL('sw.js', root), 'utf8');
  let previous = -1;
  for (const name of ['state.js', 'standalone-geo.js', 'spatial-math.js', 'app.js']) {
    const script = '<script src="./' + name + '" defer></script>';
    const index = html.indexOf(script);
    assert.ok(index > previous, 'script order: ' + name);
    assert.ok(worker.includes("'./" + name + "'"), 'cached script: ' + name);
    previous = index;
  }
  assert.doesNotMatch(html, /type="module"/u);
});

test('packaging includes inline math and maintains manifest inventory', async () => {
  const app = new URL('../apps/aethergrid-console/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('app.json', app), 'utf8'));
  const packager = await readFile(
    new URL('../scripts/assemble-aethergrid-full-app.mjs', import.meta.url),
    'utf8',
  );
  assert.ok(manifest.legacyCompatibility.sourceFiles.includes('spatial-math.js'));
  assert.ok(packager.includes("legacySource.get('spatial-math.js')"));
  assert.ok(packager.includes('legacy/spatial-math.js'));
  assert.ok(packager.includes('legacyMathJs'));
});
