import assert from 'node:assert/strict';
import test from 'node:test';

test('background camera tiles preserve the active city used by operator analysis', async () => {
  const prior = process.env.AETHERGRID_GEO_PROVIDER;
  process.env.AETHERGRID_GEO_PROVIDER = 'disabled-for-test';
  const { server } = await import('../apps/aethergrid-console/server.mjs');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const selected = await fetch(origin + '/api/aethergrid/geospatial/city/new-york?spatial=1');
    assert.equal(selected.status, 200);
    const activeBefore = await fetch(origin + '/api/aethergrid/city-operations/use-cases').then(
      (response) => response.json(),
    );
    assert.equal(activeBefore.activeCity.id, 'new-york');
    const tile = await fetch(
      origin +
        '/api/aethergrid/geospatial/point?lat=40.7608&lon=-73.978&radiusM=450&spatial=1&tile=1',
    );
    assert.equal(tile.status, 200);
    const payload = await tile.json();
    assert.match(payload.city.id, /^coord-/u);
    const activeAfter = await fetch(origin + '/api/aethergrid/city-operations/use-cases').then(
      (response) => response.json(),
    );
    assert.equal(activeAfter.activeCity.id, 'new-york');
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (prior === undefined) delete process.env.AETHERGRID_GEO_PROVIDER;
    else process.env.AETHERGRID_GEO_PROVIDER = prior;
  }
});
