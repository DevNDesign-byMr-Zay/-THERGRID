import assert from 'node:assert/strict';
import test from 'node:test';
import { createGeoRuntime } from '../apps/aethergrid-console/geo-runtime.mjs';

const point = { lat: 40, lon: -74, name: 'Behavior fixture' };

function building(id, tags) {
  return {
    type: 'way',
    id,
    tags: { building: 'yes', ...tags },
    geometry: [
      { lat: 40, lon: -74 },
      { lat: 40, lon: -73.9999 },
      { lat: 40.0001, lon: -73.9999 },
      { lat: 40.0001, lon: -74 },
      { lat: 40, lon: -74 },
    ],
  };
}

function fixtureRuntime(context = []) {
  let requests = 0;
  const runtime = createGeoRuntime({
    env: { AETHERGRID_OVERPASS_URL: 'https://overpass.example.test/api' },
    fetchImpl: async () => {
      requests += 1;
      return {
        ok: true,
        json: async () => ({
          elements:
            requests % 2 === 1
              ? [
                  building(1, { height: '100 ft', 'building:levels': '99' }),
                  building(2, { est_height: '25,5' }),
                  building(3, { 'building:levels': '10' }),
                  building(4, { height: '5000' }),
                  building(5, { height: 'invalid' }),
                ]
              : context,
        }),
      };
    },
  });
  return { runtime, requests: () => requests };
}

test('geospatial heights convert units and preserve source precedence', async () => {
  const { runtime } = fixtureRuntime();
  const mesh = await runtime.pointMesh(point);
  assert.equal(mesh.source.live, true);
  assert.equal(mesh.buildings.length, 5);
  const byId = (id) => mesh.buildings.find((item) => item.osmId === id);
  assert.ok(Math.abs(byId(1).heightM - 30.48) < 1e-9);
  assert.equal(byId(1).heightSource, 'height');
  assert.equal(byId(2).heightM, 25.5);
  assert.equal(byId(2).heightSource, 'est_height');
  assert.equal(byId(3).heightM, 32);
  assert.equal(byId(3).heightSource, 'building:levels');
  assert.equal(byId(4).heightM, 1200);
  assert.equal(byId(5).heightSource, 'inferred');
  assert.ok(byId(5).heightM >= 8 && byId(5).heightM <= 42);
});

test('geospatial power assets select maximum voltage and retain unknown values', async () => {
  const { runtime } = fixtureRuntime([
    {
      type: 'node',
      id: 10,
      lat: 40,
      lon: -74,
      tags: { power: 'substation', voltage: '33 000;138000' },
    },
    {
      type: 'node',
      id: 11,
      lat: 40,
      lon: -74,
      tags: { power: 'transformer', voltage: 'unknown' },
    },
  ]);
  const mesh = await runtime.pointMesh(point);
  assert.equal(mesh.powerAssets.find((item) => item.osmId === 10).voltage, 138000);
  assert.equal(mesh.powerAssets.find((item) => item.osmId === 11).voltage, null);
});

test('synthetic geometry is deterministic, bounded and explicitly non-live', async () => {
  let requests = 0;
  const runtime = createGeoRuntime({
    env: { AETHERGRID_GEO_PROVIDER: 'local' },
    fetchImpl: async () => {
      requests += 1;
      throw new Error('unexpected network request');
    },
  });
  const first = await runtime.pointMesh(point);
  const second = await runtime.pointMesh(point);
  const other = await runtime.pointMesh({ ...point, lon: -73 });
  assert.equal(requests, 0);
  assert.equal(first.source.live, false);
  assert.equal(first.source.provider, 'local-fallback');
  assert.equal(first.buildings.length, 110);
  assert.deepEqual(first.buildings, second.buildings);
  assert.notDeepEqual(first.buildings, other.buildings);
  for (const item of first.buildings) {
    assert.equal(item.heightSource, 'synthetic-fallback');
    assert.ok(item.heightM >= 10 && item.heightM <= 105);
    assert.deepEqual(item.footprint[0], item.footprint.at(-1));
    assert.ok(item.footprint.flat().every(Number.isFinite));
  }
});

test('invalid geospatial coordinates fail before making network requests', async () => {
  const { runtime, requests } = fixtureRuntime();
  for (const input of [
    { lat: 91, lon: 0 },
    { lat: 0, lon: -181 },
    { lat: 'invalid', lon: 0 },
  ]) {
    await assert.rejects(runtime.pointMesh(input), { status: 400 });
  }
  await assert.rejects(runtime.cityMesh('missing-city'), { status: 404 });
  assert.equal(requests(), 0);
});

test('geospatial successful responses are cached until explicitly refreshed', async () => {
  const { runtime, requests } = fixtureRuntime();
  const first = await runtime.pointMesh(point);
  const cached = await runtime.pointMesh(point);
  assert.equal(cached, first);
  assert.equal(requests(), 2);
  await runtime.pointMesh(point, { force: true });
  assert.equal(requests(), 4);
});
