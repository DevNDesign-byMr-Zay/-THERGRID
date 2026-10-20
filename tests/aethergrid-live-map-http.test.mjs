import test from 'node:test';
import assert from 'node:assert/strict';

test('HTTP aviation/radar routes return genuine normalized observations and reject invalid coordinates', async () => {
  const nativeFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('http://127.0.0.1')) return nativeFetch(url, init);
    requests++;
    const now = Date.now();
    if (String(url).includes('rainviewer'))
      return Response.json({
        generated: Math.floor(now / 1000),
        host: 'https://tilecache.rainviewer.com',
        radar: {
          past: [
            {
              time: Math.floor(now / 1000) - 600,
              path: '/v2/radar/' + (Math.floor(now / 1000) - 600),
            },
          ],
        },
      });
    if (String(url).includes('adsb.lol'))
      return Response.json({
        now,
        ac: [{ hex: 'abc123', lat: 40.7, lon: -74, seen_pos: 1, alt_geom: 10000, track: 90 }],
      });
    return Response.json({ time: Math.floor(now / 1000), states: [] });
  };
  const { server } = await import('../apps/aethergrid-console/server.mjs');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const aircraft = await nativeFetch(
      origin + '/api/aethergrid/domains/aviation/aircraft?scope=city&latitude=40.7&longitude=-74',
    ).then((r) => r.json());
    assert.equal(aircraft.receipt.live, true);
    assert.equal(aircraft.data.aircraft[0].icaoHex, 'abc123');
    const before = requests;
    const bad = await nativeFetch(
      origin + '/api/aethergrid/domains/aviation/aircraft?scope=city&latitude=100&longitude=-74',
    );
    assert.equal(bad.status, 400);
    assert.equal(requests, before);
    const bridge = await nativeFetch(
      origin + '/api/aethergrid/domains/aviation/aircraft?scope=global',
      { headers: { origin: 'null' } },
    );
    assert.equal(bridge.headers.get('access-control-allow-origin'), 'null');
    assert.equal(bridge.status, 200);
    const preflight = await nativeFetch(origin + '/api/aethergrid/domains/aviation/aircraft', {
      method: 'OPTIONS',
      headers: { origin: 'null' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
    const profile = await nativeFetch(origin + '/api/aethergrid/profile', {
      headers: { origin: 'null' },
    });
    assert.equal(profile.headers.get('access-control-allow-origin'), null);
    const remoteOrigin = await nativeFetch(
      origin + '/api/aethergrid/domains/aviation/aircraft?scope=global',
      { headers: { origin: 'https://unrelated.example' } },
    );
    assert.equal(remoteOrigin.headers.get('access-control-allow-origin'), null);
    const radar = await nativeFetch(origin + '/api/aethergrid/weather/radar').then((r) => r.json());
    assert.equal(radar.frames.length, 1);
    assert.ok(radar.coverage.includes('partial'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = nativeFetch;
  }
});
