import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeGeospatialContext } from '../apps/aethergrid-console/analysis/geospatial-context.mjs';

function cityMesh() {
  return {
    city: { id: 'new-york', name: 'New York', lat: 40.7, lon: -74, radiusM: 1400 },
    source: { provider: 'openstreetmap', live: true },
    skylineProfile: { sourceBackedHeightCoveragePercent: 73 },
    buildings: [{ id: 'source-building' }],
    roads: [{ id: 'source-road' }],
    powerLines: [{ id: 'source-line' }],
    powerAssets: [{ id: 'source-asset' }],
    terrain: {
      source: { provider: 'cesium', live: true },
      minElevationM: -2,
      maxElevationM: 110,
    },
    environment: {
      source: { provider: 'open-meteo', live: true, modelTime: '2026-10-29T12:00:00Z' },
      current: {
        temperatureC: 18,
        precipitationMm: 0.2,
        isDay: true,
        windSpeedKph: 12,
        surfacePressureHpa: 1015,
      },
      solar: { sunrise: '2026-10-29T10:00:00Z', sunset: '2026-10-29T22:00:00Z' },
    },
    liveContext: {
      airQuality: {
        source: { provider: 'open-meteo', live: true },
        current: { usAqi: 42, pm25UgM3: 8 },
      },
      seismic: {
        source: { provider: 'usgs', live: true },
        eventCount: 2,
        maxMagnitude: 3.3,
      },
    },
  };
}

test('mapped city evidence preserves provider origin and independent source receipts', () => {
  const mesh = cityMesh();
  const context = summarizeGeospatialContext(mesh);
  assert.deepEqual({
    cityId: context.cityId,
    lat: context.lat,
    lon: context.lon,
    source: context.source,
    live: context.live,
    buildings: context.buildings,
    roads: context.roads,
    powerLines: context.powerLines,
    powerAssets: context.powerAssets,
  }, {
    cityId: 'new-york',
    lat: 40.7,
    lon: -74,
    source: 'openstreetmap',
    live: true,
    buildings: 1,
    roads: 1,
    powerLines: 1,
    powerAssets: 1,
  });
  assert.deepEqual(context.terrain, {
    provider: 'cesium',
    live: true,
    minElevationM: -2,
    maxElevationM: 110,
  });
  assert.equal(context.environment.observedAt, '2026-10-29T12:00:00Z');
  assert.equal(context.environment.temperatureC, 18);
  assert.equal(context.liveContext.airQualityProvider, 'open-meteo');
  assert.equal(context.liveContext.liveSeismic, true);
  assert.equal(context.liveContext.seismicEventCount, 2);
});

test('unavailable and modeled sources stay explicitly unavailable', () => {
  const mesh = cityMesh();
  mesh.source.live = false;
  mesh.source.provider = 'local-fallback';
  mesh.terrain = null;
  mesh.environment = null;
  mesh.liveContext = null;
  mesh.roads = [];
  mesh.powerAssets = [];
  mesh.powerLines = [];
  const context = summarizeGeospatialContext(mesh);
  assert.equal(context.live, false);
  assert.equal(context.source, 'local-fallback');
  assert.equal(context.terrain.provider, null);
  assert.equal(context.terrain.live, false);
  assert.equal(context.terrain.minElevationM, null);
  assert.equal(context.environment.live, false);
  assert.equal(context.environment.observedAt, null);
  assert.equal(context.environment.temperatureC, null);
  assert.equal(context.liveContext.liveAirQuality, false);
  assert.equal(context.liveContext.usAqi, null);
  assert.equal(context.liveContext.liveSeismic, false);
  assert.equal(context.liveContext.seismicEventCount, 0);
  assert.equal(context.roads, 0);
  assert.equal(context.powerAssets, 0);
});

test('city and point presentations yield identical independent summaries', () => {
  const mesh = cityMesh();
  const first = summarizeGeospatialContext(mesh);
  const second = summarizeGeospatialContext(mesh);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(first.skyline, mesh.skylineProfile);
  first.cityId = 'changed-view-only';
  assert.equal(second.cityId, 'new-york');
  assert.equal(mesh.city.id, 'new-york');
});
