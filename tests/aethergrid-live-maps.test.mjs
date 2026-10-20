import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveMapRuntime } from '../apps/aethergrid-console/providers/live-map-runtime.mjs';
const time = Date.parse('2026-10-20T08:00:00Z');
const adsb = {
  now: time,
  ac: [
    {
      hex: 'abc123',
      flight: ' TEST1 ',
      lat: 40.7,
      lon: -74,
      alt_baro: 10000,
      alt_geom: null,
      gs: 250,
      track: 90,
      baro_rate: 500,
      seen_pos: 2,
    },
    { hex: 'missing', lat: null, lon: null, seen_pos: 0 },
    { hex: 'old', lat: 41, lon: -73, seen_pos: 500 },
  ],
};
const states = {
  time: time / 1000,
  states: [
    [
      'def456',
      ' TEST2 ',
      'US',
      time / 1000 - 3,
      time / 1000,
      -73,
      41,
      null,
      false,
      100,
      180,
      2,
      null,
      3500,
      '1234',
    ],
  ],
};

test('city aircraft preserve observed coordinates, source time and units without inventing null altitudes', async () => {
  const runtime = createLiveMapRuntime({
    now: () => time,
    fetchImpl: async () => Response.json(adsb),
  });
  const r = await runtime.aviation({
    scope: 'city',
    latitude: 40.7,
    longitude: -74,
    radiusKm: 250,
  });
  assert.equal(r.data.aircraft.length, 1);
  const a = r.data.aircraft[0];
  assert.equal(a.barometricAltitudeMeters, 3048);
  assert.equal(a.geometricAltitudeMeters, null);
  assert.equal(a.callsign, 'TEST1');
  assert.equal(a.observedAt, '2026-10-20T07:59:58.000Z');
  assert.equal(r.receipt.provider, 'adsb-lol');
  assert.equal(r.receipt.live, true);
});
test('world aircraft use OpenSky and deduplicate cached requests within anonymous quota', async () => {
  let calls = 0,
    now = time;
  const runtime = createLiveMapRuntime({
    now: () => now,
    fetchImpl: async (url) => {
      calls++;
      assert.equal(String(url), 'https://opensky-network.org/api/states/all');
      return Response.json(states);
    },
  });
  const [a, b] = await Promise.all([
    runtime.aviation({ scope: 'global' }),
    runtime.aviation({ scope: 'global' }),
  ]);
  assert.equal(calls, 1);
  assert.equal(a.data.aircraft[0].barometricAltitudeMeters, null);
  assert.equal(a.data.aircraft[0].geometricAltitudeMeters, 3500);
  assert.equal(a.data.aircraft[0].groundSpeedKnots, 100 * 1.9438444924406);
  now += 180000;
  const stale = await runtime.aviation({ scope: 'global' });
  assert.equal(calls, 1);
  assert.equal(stale.receipt.live, false);
  assert.equal(stale.receipt.stale, true);
  assert.equal(b.data.aircraft.length, 1);
});
test('invalid coordinates and unknown scope never trigger aircraft network requests', async () => {
  let calls = 0;
  const r = createLiveMapRuntime({
    fetchImpl: async () => {
      calls++;
      return Response.json(adsb);
    },
  });
  for (const q of [
    { scope: 'city', latitude: null, longitude: 0 },
    { scope: 'city', latitude: 100, longitude: 0 },
    { scope: 'other' },
    { scope: 'city', latitude: 0, longitude: 0, radiusKm: -1 },
  ])
    await assert.rejects(() => r.aviation(q), /Invalid/);
  assert.equal(calls, 0);
});
test('radar manifests reject arbitrary tile origins, future frames and unusable payloads', async () => {
  const r = createLiveMapRuntime({
    now: () => time,
    fetchImpl: async () =>
      Response.json({
        generated: time / 1000,
        host: 'https://attacker.test',
        radar: { past: [{ time: time / 1000, path: '/v2/radar/123' }] },
      }),
  });
  await assert.rejects(() => r.radar(), /origin/);
  const good = createLiveMapRuntime({
    now: () => time,
    fetchImpl: async () =>
      Response.json({
        generated: time / 1000,
        host: 'https://tilecache.rainviewer.com',
        radar: {
          past: [
            { time: time / 1000 - 600, path: '/v2/radar/8a31e16b4d3f' },
            { time: time / 1000 + 600, path: '/v2/radar/' + (time / 1000 + 600) },
          ],
        },
      }),
  });
  const m = await good.radar();
  assert.equal(m.frames.length, 1);
  assert.equal(m.frames[0].time, '2026-10-20T07:50:00.000Z');
  assert.ok(m.frames[0].urlTemplate.includes('/256/{z}/{x}/{y}/'));
  assert.equal(m.maximumLevel, 7);
});
test('source failures retain dated stale observations with a bounded retry backoff', async () => {
  let now = time,
    calls = 0;
  const r = createLiveMapRuntime({
    now: () => now,
    fetchImpl: async () => {
      calls++;
      if (calls > 1) throw Error('offline');
      return Response.json(adsb);
    },
  });
  const q = { scope: 'city', latitude: 40, longitude: -74 };
  await r.aviation(q);
  now += 20000;
  const stale = await r.aviation(q);
  assert.equal(stale.receipt.stale, true);
  assert.equal(stale.receipt.live, false);
  await r.aviation(q);
  assert.equal(calls, 2);
});
test('OpenSky OAuth stays server side and refreshes one token for concurrent queries', async () => {
  let tokens = 0;
  const r = createLiveMapRuntime({
    now: () => time,
    clientId: 'id',
    clientSecret: 'private',
    fetchImpl: async (url, init) => {
      if (String(url).includes('openid-connect')) {
        tokens++;
        assert.ok(String(init.body).includes('client_secret=private'));
        return Response.json({ access_token: 'credential', expires_in: 1800 });
      }
      assert.equal(init.headers.authorization, 'Bearer credential');
      return Response.json(states);
    },
  });
  const value = await r.aviation({ scope: 'global' });
  assert.equal(tokens, 1);
  assert.ok(!JSON.stringify(value).includes('credential'));
  assert.ok(!JSON.stringify(value).includes('private'));
});
test('long provider cooldowns never retain stale aircraft beyond thirty minutes', async () => {
  let now = time;
  let calls = 0;
  const runtime = createLiveMapRuntime({
    now: () => now,
    fetchImpl: async () => {
      calls++;
      return calls === 1
        ? Response.json(adsb)
        : new Response('', { status: 429, headers: { 'retry-after': '3600' } });
    },
  });
  const query = { scope: 'city', latitude: 40, longitude: -74 };
  await runtime.aviation(query);
  now += 20000;
  assert.equal((await runtime.aviation(query)).receipt.stale, true);
  now = time + 31 * 60000;
  await assert.rejects(() => runtime.aviation(query), /cooling down|expired/);
  assert.equal(calls, 2);
});
