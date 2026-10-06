import test from 'node:test';
import assert from 'node:assert/strict';

import { createGeoRuntime } from '../apps/aethergrid-console/geo-runtime.mjs';
import { createOvertureProvider } from '../apps/aethergrid-console/providers/overture-provider.mjs';

function createMockOverpassPayload(buildingCount = 15) {
  const elements = [];
  for (let i = 0; i < buildingCount; i++) {
    elements.push({
      type: 'way',
      id: 1000 + i,
      tags: { building: 'yes', name: `Building ${i + 1}`, height: '25' },
      geometry: [
        { lat: 40.7549, lon: -73.984 },
        { lat: 40.755, lon: -73.984 },
        { lat: 40.755, lon: -73.9839 },
        { lat: 40.7549, lon: -73.9839 },
        { lat: 40.7549, lon: -73.984 },
      ],
    });
  }
  return {
    osm3s: { timestamp_osm_base: '2026-10-05T12:00:00Z' },
    elements,
  };
}

test('city source resilience: Overpass success returns complete completeness metadata and live true', async () => {
  const mockPayload = createMockOverpassPayload(12);
  const geo = createGeoRuntime({
    env: { AETHERGRID_GEO_PROVIDER: 'osm-overpass' },
    fetchImpl: async () => ({
      ok: true,
      json: async () => mockPayload,
    }),
  });

  const city = { id: 'test-city', name: 'Test City', lat: 40.7549, lon: -73.984, radiusM: 500 };
  const res = await geo.pointMesh(city, { force: true });

  assert.equal(res.source.live, true);
  assert.equal(res.source.fallbackUsed, false);
  assert.equal(res.source.completeness, 'complete');
  assert.equal(res.source.buildingCount, 12);
  assert.equal(res.buildings.length, 12);
  assert.ok(res.source.endpointsTried.length >= 1);
});

test('city source resilience: empty Overpass response yields completeness empty without synthetic substitution', async () => {
  const geo = createGeoRuntime({
    env: { AETHERGRID_GEO_PROVIDER: 'osm-overpass' },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ osm3s: { timestamp_osm_base: '2026-10-05T12:00:00Z' }, elements: [] }),
    }),
  });

  const city = { id: 'desert-node', name: 'Desert Node', lat: 25.0, lon: 45.0, radiusM: 500 };
  const res = await geo.pointMesh(city, { force: true });

  assert.equal(res.source.live, true);
  assert.equal(res.source.fallbackUsed, false);
  assert.equal(res.source.completeness, 'empty');
  assert.equal(res.source.buildingCount, 0);
  assert.equal(res.buildings.length, 0);
});

test('city source resilience: sparse response triggers tiling attempt and deduplicates elements', async () => {
  let callCount = 0;
  const geo = createGeoRuntime({
    env: { AETHERGRID_GEO_PROVIDER: 'osm-overpass' },
    fetchImpl: async () => {
      callCount++;
      return {
        ok: true,
        json: async () => createMockOverpassPayload(2),
      };
    },
  });

  const city = { id: 'sparse-city', name: 'Sparse City', lat: 40.7549, lon: -73.984, radiusM: 500 };
  const res = await geo.pointMesh(city, { force: true });

  assert.ok(callCount > 1, 'Expected tile sub-queries when initial result is sparse');
  assert.equal(res.source.live, true);
  assert.equal(res.buildings.length, 2, 'Deduplication preserved unique elements');
});

test('city source resilience: primary endpoint failure triggers failover to backup endpoint', async () => {
  const requestedEndpoints = [];
  const geo = createGeoRuntime({
    env: {
      AETHERGRID_GEO_PROVIDER: 'osm-overpass',
      AETHERGRID_OVERPASS_URL: 'https://failing-primary.example.com/api/interpreter',
    },
    fetchImpl: async (url) => {
      requestedEndpoints.push(String(url));
      if (String(url).includes('failing-primary.example.com')) {
        throw new Error('503 Service Unavailable');
      }
      return {
        ok: true,
        json: async () => createMockOverpassPayload(10),
      };
    },
  });

  const city = {
    id: 'failover-city',
    name: 'Failover City',
    lat: 40.7549,
    lon: -73.984,
    radiusM: 500,
  };
  const res = await geo.pointMesh(city, { force: true });

  assert.equal(res.source.live, true);
  assert.equal(res.source.completeness, 'complete');
  assert.ok(requestedEndpoints.length >= 2, 'Tried primary and at least one backup endpoint');
});

test('city source resilience: all Overpass endpoints failing returns local fallback with live false', async () => {
  const geo = createGeoRuntime({
    env: { AETHERGRID_GEO_PROVIDER: 'osm-overpass' },
    fetchImpl: async () => {
      throw new Error('Connection refused');
    },
  });

  const city = {
    id: 'offline-city',
    name: 'Offline City',
    lat: 40.7549,
    lon: -73.984,
    radiusM: 500,
  };
  const res = await geo.pointMesh(city, { force: true });

  assert.equal(res.source.live, false);
  assert.equal(res.source.fallbackUsed, true);
  assert.equal(res.source.completeness, 'fallback');
  assert.ok(res.buildings.length > 0, 'Synthetic fallback buildings generated for offline use');
});

test('overture provider: unconfigured state when credentials/URL missing', async () => {
  const provider = createOvertureProvider({ apiKey: '', baseUrl: '' });
  assert.equal(provider.configured(), false);

  const res = await provider.request({ lat: 40.7128, lon: -74.006 });
  assert.equal(res.data.status, 'unconfigured');
  assert.equal(res.receipt.live, false);
});

test('overture provider: fetches buildings and normalizes features when configured', async () => {
  const provider = createOvertureProvider({
    apiKey: 'test-overture-key',
    baseUrl: 'https://overturemaps.org/api/v1',
    fetchFn: async () => ({
      features: [
        {
          id: 'ov-b1',
          properties: { name: 'Empire State', height: 381, num_floors: 102 },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    }),
  });

  assert.equal(provider.configured(), true);
  const res = await provider.request({ lat: 40.7484, lon: -73.9857 });

  assert.equal(res.data.status, 'Overture City Data Retrieved');
  assert.equal(res.data.buildings.length, 1);
  assert.equal(res.data.buildings[0].name, 'Empire State');
  assert.equal(res.data.buildings[0].heightM, 381);
  assert.equal(res.receipt.live, true);
});
