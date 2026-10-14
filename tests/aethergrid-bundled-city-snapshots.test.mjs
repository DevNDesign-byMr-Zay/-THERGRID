import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';

test('all eight offline districts retain distinct mapped geometry and dated source receipts', async () => {
  const directory = new URL('../apps/aethergrid-console/assets/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('city-snapshots-manifest.json', directory)));
  assert.equal(manifest.cities.length, 8);
  const hashes = new Set();
  for (const record of manifest.cities) {
    const bytes = gunzipSync(
      await readFile(new URL(`cities/${record.city.id}.json.gz`, directory)),
    );
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash, record.jsonSha256);
    hashes.add(hash);
    const mesh = JSON.parse(bytes);
    assert.equal(mesh.source.live, false);
    assert.equal(mesh.source.snapshot, true);
    assert.equal(mesh.source.provider, 'bundled-openstreetmap');
    assert.ok(Number.isFinite(Date.parse(mesh.source.fetchedAt)));
    assert.ok(mesh.buildings.length > 100);
    assert.ok(mesh.roads.length > 0);
    assert.ok(
      mesh.buildings.every(
        (b) => b.footprint.length >= 3 && b.heightSource !== 'synthetic-fallback',
      ),
    );
  }
  assert.equal(hashes.size, 8);
});
