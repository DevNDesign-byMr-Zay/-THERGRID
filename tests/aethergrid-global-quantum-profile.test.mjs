import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createCityEnvironmentRuntime } from '../apps/aethergrid-console/city-environment-runtime.mjs';
import { createGeoRuntime } from '../apps/aethergrid-console/geo-runtime.mjs';
import { createProfileStore } from '../apps/aethergrid-console/profile-store.mjs';
import { API_VERSION, createQuantumRuntime } from '../apps/aethergrid-console/quantum-runtime.mjs';
import { createTerrainRuntime } from '../apps/aethergrid-console/terrain-runtime.mjs';

test('operator profile persists sanitized local identity data without secrets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aethergrid-profile-'));
  try {
    const store = createProfileStore({
      dataDir: directory,
      now: () => '2026-09-30T00:00:00.000Z',
    });
    const saved = await store.save({
      displayName: 'Test Operator',
      initials: 'to',
      title: 'Spatial Analyst',
      organization: 'ÆTHERGRID Lab',
      homeRegion: 'New York Metro',
      timezone: 'America/New_York',
      bio: 'Testing a persistent profile.',
      avatarDataUrl: 'data:image/webp;base64,AAAA',
    });
    assert.equal(saved.initials, 'TO');
    assert.equal(saved.updatedAt, '2026-09-30T00:00:00.000Z');

    const loaded = await store.load();
    assert.equal(loaded.displayName, 'Test Operator');
    assert.equal(loaded.avatarDataUrl, 'data:image/webp;base64,AAAA');

    const raw = await readFile(store.profilePath, 'utf8');
    assert.match(raw, /"displayName": "Test Operator"/u);
    assert.doesNotMatch(raw, /api[_-]?key/iu);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('live geospatial runtime converts and caches Overpass city geometry', async () => {
  let calls = 0;
  const geometry = [
    { lat: 40.7548, lon: -73.9841 },
    { lat: 40.7548, lon: -73.9839 },
    { lat: 40.755, lon: -73.9839 },
    { lat: 40.755, lon: -73.9841 },
    { lat: 40.7548, lon: -73.9841 },
  ];
  const fetchImpl = async (url, options) => {
    calls += 1;
    assert.equal(String(url), 'https://example.test/overpass');
    assert.equal(options.method, 'POST');
    assert.match(String(options.headers['user-agent']), /AETHERGRID/u);
    assert.match(options.body.get('data'), /nwr\["building:part"\]/u);
    assert.match(options.body.get('data'), /nwr\["building"\]/u);
    return new Response(
      JSON.stringify({
        osm3s: { timestamp_osm_base: '2026-09-30T06:30:00Z' },
        elements: [
          ...Array.from({ length: 8 }, (_, index) => ({
            type: 'way',
            id: 1000 + index,
            tags: { building: 'yes', 'building:levels': String(3 + index) },
            geometry: geometry.map((point) => ({
              lat: point.lat + index * 0.00012,
              lon: point.lon + index * 0.00012,
            })),
          })),
          {
            type: 'way',
            id: 1500,
            tags: { 'building:part': 'yes', height: '42', min_height: '6' },
            geometry: geometry.map((point) => ({
              lat: point.lat + 0.0011,
              lon: point.lon + 0.0011,
            })),
          },
          {
            type: 'way',
            id: 1600,
            tags: {
              building: 'yes',
              name: 'Skyline Tower',
              height: '828',
              'building:material': 'glass',
              'roof:shape': 'pyramidal',
              'roof:height': '20',
            },
            geometry: geometry.map((point) => ({
              lat: point.lat + 0.0015,
              lon: point.lon + 0.0015,
            })),
          },
          {
            type: 'relation',
            id: 1700,
            tags: { building: 'yes', name: 'Relation Building', height: '310 ft' },
            members: [
              {
                type: 'way',
                role: 'outer',
                geometry: geometry.map((point) => ({
                  lat: point.lat + 0.0018,
                  lon: point.lon + 0.0018,
                })),
              },
            ],
          },
          {
            type: 'way',
            id: 2001,
            tags: { highway: 'primary', name: 'Test Avenue' },
            geometry: geometry.slice(0, 3),
          },
          {
            type: 'way',
            id: 3001,
            tags: {
              power: 'line',
              name: 'Test Transmission',
              voltage: '138000',
              operator: 'Grid Test',
              circuits: '2',
            },
            geometry: geometry.slice(0, 3),
          },
          {
            type: 'node',
            id: 4001,
            lat: 40.75492,
            lon: -73.98398,
            tags: {
              power: 'substation',
              name: 'Test Substation',
              voltage: '138000;33000',
              operator: 'Grid Test',
            },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const runtime = createGeoRuntime({
    env: {
      AETHERGRID_GEO_PROVIDER: 'osm-overpass',
      AETHERGRID_OVERPASS_URL: 'https://example.test/overpass',
      AETHERGRID_GEO_USER_AGENT: 'AETHERGRID-test/1.0',
      AETHERGRID_GEO_CACHE_TTL_MS: '900000',
    },
    fetchImpl,
    now: () => 1000,
  });

  const first = await runtime.cityMesh('new-york');
  assert.equal(first.source.live, true);
  assert.equal(first.source.provider, 'OpenStreetMap Overpass');
  assert.ok(first.buildings.length >= 5);
  assert.ok(first.buildings.every((building) => building.footprint.length >= 5));
  assert.ok(first.buildings.every((building) => building.heightM > 0));
  const buildingPart = first.buildings.find((building) => building.buildingPart);
  assert.ok(buildingPart);
  assert.equal(buildingPart.heightM, 42);
  assert.equal(buildingPart.minHeightM, 6);
  assert.equal(first.roads.length, 1);
  assert.equal(first.roads[0].name, 'Test Avenue');
  assert.equal(first.roads[0].highwayType, 'primary');
  assert.ok(first.roads[0].path.length >= 2);
  assert.equal(first.powerLines.length, 1);
  assert.equal(first.powerLines[0].name, 'Test Transmission');
  assert.equal(first.powerLines[0].voltage, 138000);
  assert.equal(first.powerLines[0].circuits, 2);
  assert.equal(first.powerAssets.length, 1);
  assert.equal(first.powerAssets[0].name, 'Test Substation');
  assert.equal(first.powerAssets[0].powerType, 'substation');
  assert.equal(first.powerAssets[0].voltage, 138000);
  assert.ok(first.powerAssets[0].position.every(Number.isFinite));
  assert.equal(first.source.attribution, '© OpenStreetMap contributors');
  assert.equal(first.source.upstreamTimestamp, '2026-09-30T06:30:00Z');
  assert.equal(first.skylineProfile.maxHeightM, 828);
  assert.ok(first.skylineProfile.sourceBackedHeightCoveragePercent > 0);
  const skylineTower = first.buildings.find((building) => building.name === 'Skyline Tower');
  assert.ok(skylineTower);
  assert.equal(skylineTower.heightM, 828);
  assert.equal(skylineTower.heightSource, 'height');
  assert.equal(skylineTower.roofShape, 'pyramidal');
  assert.equal(skylineTower.roofHeightM, 20);
  assert.equal(skylineTower.buildingMaterial, 'glass');
  const relationBuilding = first.buildings.find(
    (building) => building.name === 'Relation Building',
  );
  assert.ok(relationBuilding);
  assert.equal(relationBuilding.osmType, 'relation');
  assert.ok(Math.abs(relationBuilding.heightM - 94.488) < 0.01);

  const second = await runtime.cityMesh('new-york');
  assert.equal(second, first);
  assert.equal(calls, 1);
});

test('geospatial provider failure degrades explicitly to local fallback geometry', async () => {
  const runtime = createGeoRuntime({
    env: {
      AETHERGRID_GEO_PROVIDER: 'osm-overpass',
      AETHERGRID_OVERPASS_URL: 'https://example.test/overpass',
    },
    fetchImpl: async () => new Response('unavailable', { status: 503 }),
  });
  const mesh = await runtime.cityMesh('tokyo');
  assert.equal(mesh.source.live, false);
  assert.equal(mesh.source.provider, 'local-fallback');
  assert.ok(mesh.buildings.length >= 100);
  assert.ok(mesh.roads.length >= 10);
  assert.ok(mesh.powerLines.length >= 5);
  assert.ok(mesh.powerAssets.length >= 5);
  assert.equal(mesh.skylineProfile.live, false);
  assert.equal(mesh.skylineProfile.sourceBackedHeightCoveragePercent, 0);
});

test('geospatial coordinate explorer supports arbitrary valid world coordinates', async () => {
  const runtime = createGeoRuntime({
    env: { AETHERGRID_GEO_PROVIDER: 'local-fallback' },
  });
  const mesh = await runtime.pointMesh({
    lat: 48.8566,
    lon: 2.3522,
    name: 'Paris Coordinate',
    radiusM: 1500,
  });
  assert.equal(mesh.city.custom, true);
  assert.equal(mesh.city.name, 'Paris Coordinate');
  assert.equal(mesh.city.lat, 48.8566);
  assert.equal(mesh.city.lon, 2.3522);
  assert.equal(mesh.city.radiusM, 1500);
  assert.ok(mesh.buildings.length >= 100);
  assert.ok(mesh.powerLines.length >= 5);
  assert.ok(mesh.powerAssets.length >= 5);
  assert.equal(runtime.summary().supportsCustomCoordinates, true);
  assert.deepEqual(runtime.summary().layers, [
    'buildings',
    'building-parts',
    'roofs',
    'roads',
    'power-lines',
    'power-assets',
  ]);

  await assert.rejects(
    runtime.pointMesh({ lat: 120, lon: 2.3522 }),
    /latitude must be between -90 and 90/u,
  );
});

test('city environment runtime maps current open weather context without credentials', async () => {
  let requestUrl = '';
  const runtime = createCityEnvironmentRuntime({
    env: {
      AETHERGRID_ENVIRONMENT_PROVIDER: 'open-meteo',
      AETHERGRID_OPEN_METEO_URL: 'https://weather.example.test/v1/forecast',
    },
    fetchImpl: async (url) => {
      requestUrl = String(url);
      const parsed = new URL(requestUrl);
      assert.equal(parsed.searchParams.get('latitude'), '25.1972');
      assert.equal(parsed.searchParams.get('longitude'), '55.2744');
      assert.match(parsed.searchParams.get('current'), /cloud_cover/u);
      assert.match(parsed.searchParams.get('current'), /is_day/u);
      return new Response(
        JSON.stringify({
          latitude: 25.1972,
          longitude: 55.2744,
          timezone: 'Asia/Dubai',
          utc_offset_seconds: 14400,
          current: {
            time: '2026-09-30T10:30',
            interval: 900,
            temperature_2m: 34.1,
            apparent_temperature: 37.8,
            weather_code: 1,
            cloud_cover: 18,
            is_day: 1,
            precipitation: 0,
            wind_speed_10m: 12.4,
            wind_direction_10m: 305,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  const environment = await runtime.current({ lat: 25.1972, lon: 55.2744 });
  assert.match(requestUrl, /^https:\/\/weather\.example\.test\/v1\/forecast\?/u);
  assert.equal(environment.source.live, true);
  assert.equal(environment.source.provider, 'Open-Meteo');
  assert.equal(environment.timezone, 'Asia/Dubai');
  assert.equal(environment.current.temperatureC, 34.1);
  assert.equal(environment.current.cloudCoverPercent, 18);
  assert.equal(environment.current.isDay, true);
  assert.equal(environment.current.windSpeedKph, 12.4);
  assert.equal(runtime.summary().credentialsExposed, false);

  const fallback = createCityEnvironmentRuntime({
    env: { AETHERGRID_ENVIRONMENT_PROVIDER: 'local-fallback' },
  });
  const local = await fallback.current({ lat: 35.6896, lon: 139.6917 });
  assert.equal(local.source.live, false);
  assert.equal(local.source.provider, 'local-environment-fallback');
  assert.equal(local.current, null);
});

test('terrain runtime samples real-coordinate elevation grids through a provider adapter', async () => {
  let requestUrl = '';
  const runtime = createTerrainRuntime({
    env: {
      AETHERGRID_TERRAIN_PROVIDER: 'open-meteo',
      AETHERGRID_ELEVATION_URL: 'https://elevation.example.test/v1/elevation',
    },
    fetchImpl: async (url) => {
      requestUrl = String(url);
      const parsed = new URL(requestUrl);
      const count = parsed.searchParams.get('latitude').split(',').length;
      assert.equal(count, 25);
      assert.equal(parsed.searchParams.get('longitude').split(',').length, 25);
      return new Response(
        JSON.stringify({
          elevation: Array.from({ length: count }, (_, index) => 30 + index * 0.5),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  const terrain = await runtime.sample({
    lat: 40.7128,
    lon: -74.006,
    radiusM: 900,
    gridSize: 5,
  });
  assert.match(requestUrl, /^https:\/\/elevation\.example\.test\/v1\/elevation\?/u);
  assert.equal(terrain.source.live, true);
  assert.equal(terrain.source.provider, 'Open-Meteo Elevation');
  assert.equal(terrain.gridSize, 5);
  assert.equal(terrain.points.length, 25);
  assert.equal(terrain.minElevationM, 30);
  assert.equal(terrain.maxElevationM, 42);
  assert.equal(terrain.points[0].relativeElevationM, 0);
  assert.match(terrain.source.attribution, /Open-Meteo/u);
  assert.equal(runtime.summary().credentialsExposed, false);
  assert.equal(runtime.summary().resolutionMeters, 90);
});

test('terrain runtime degrades explicitly to a flat local surface when elevation is unavailable', async () => {
  const runtime = createTerrainRuntime({
    env: {
      AETHERGRID_TERRAIN_PROVIDER: 'open-meteo',
      AETHERGRID_ELEVATION_URL: 'https://elevation.example.test/v1/elevation',
    },
    fetchImpl: async () => new Response('unavailable', { status: 503 }),
  });
  const terrain = await runtime.sample({
    lat: 35.6762,
    lon: 139.6503,
    radiusM: 900,
    gridSize: 7,
  });
  assert.equal(terrain.source.live, false);
  assert.equal(terrain.source.provider, 'flat-local-fallback');
  assert.equal(terrain.points.length, 49);
  assert.ok(terrain.points.every((point) => point.relativeElevationM === 0));
  assert.match(terrain.source.error, /Elevation HTTP 503/u);
});

test('terrain runtime samples attributed elevation and preserves flat fallback', async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, 'https://elevation.example.test');
    const latitudes = parsed.searchParams.get('latitude').split(',');
    const longitudes = parsed.searchParams.get('longitude').split(',');
    assert.equal(latitudes.length, 25);
    assert.equal(longitudes.length, 25);
    return new Response(
      JSON.stringify({
        elevation: Array.from({ length: 25 }, (_, index) => 12 + (index % 5) * 3),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const runtime = createTerrainRuntime({
    env: {
      AETHERGRID_TERRAIN_PROVIDER: 'open-meteo',
      AETHERGRID_ELEVATION_URL: 'https://elevation.example.test/v1/elevation',
    },
    fetchImpl,
  });

  const summary = runtime.summary();
  assert.equal(summary.provider, 'open-meteo');
  assert.equal(summary.credentialsExposed, false);
  assert.match(summary.attribution, /Copernicus DEM GLO-90/u);

  const terrain = await runtime.sample({
    lat: 40.7128,
    lon: -74.006,
    radiusM: 900,
    gridSize: 5,
  });
  assert.equal(terrain.source.live, true);
  assert.equal(terrain.source.provider, 'Open-Meteo Elevation');
  assert.equal(terrain.gridSize, 5);
  assert.equal(terrain.points.length, 25);
  assert.equal(terrain.minElevationM, 12);
  assert.equal(terrain.maxElevationM, 24);
  assert.ok(terrain.points.every((point) => Number.isFinite(point.relativeElevationM)));

  const fallback = createTerrainRuntime({
    env: { AETHERGRID_TERRAIN_PROVIDER: 'flat-local' },
  });
  const flat = await fallback.sample({
    lat: 51.5074,
    lon: -0.1278,
    radiusM: 500,
    gridSize: 3,
  });
  assert.equal(flat.source.provider, 'flat-local-fallback');
  assert.equal(flat.source.live, false);
  assert.equal(flat.points.length, 9);
  assert.ok(flat.points.every((point) => point.elevationM === 0));
});

test('IBM Quantum adapter submits jobs while keeping credentials private', async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    const href = String(url);
    requests.push({ href, options });
    if (href === 'https://iam.example.test/token') {
      assert.match(String(options.body), /apikey=test-api-key/u);
      return new Response(JSON.stringify({ access_token: 'test-bearer', expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    assert.equal(options.headers.authorization, 'Bearer test-bearer');
    assert.equal(options.headers['service-crn'], 'crn:test:quantum');
    assert.equal(options.headers['ibm-api-version'], API_VERSION);

    if (href === 'https://quantum.example.test/api/v1/backends') {
      return new Response(
        JSON.stringify({
          devices: [
            {
              name: 'ibm_test_qpu',
              status: { name: 'online', reason: '' },
              is_simulator: false,
              qubits: 127,
              queue_length: 2,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (href === 'https://quantum.example.test/api/v1/jobs' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.backend, 'ibm_test_qpu');
      assert.equal(body.params.version, 2);
      assert.match(body.params.pubs[0][0], /^OPENQASM 3\.0;/u);
      if (body.program_id === 'estimator') {
        assert.equal(body.params.pubs[0][1], 'ZZ');
        return new Response(JSON.stringify({ id: 'job-estimator-456', status: 'Queued' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      assert.equal(body.program_id, 'sampler');
      return new Response(JSON.stringify({ id: 'job-123', status: 'Queued' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (href === 'https://quantum.example.test/api/v1/jobs?limit=20') {
      return new Response(
        JSON.stringify({
          jobs: [
            {
              id: 'job-123',
              backend: 'ibm_test_qpu',
              program: { id: 'sampler' },
              state: { status: 'Queued', reason: '' },
              created: '2026-09-30T00:00:00Z',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (href === 'https://quantum.example.test/api/v1/jobs/job-123') {
      return new Response(
        JSON.stringify({
          id: 'job-123',
          backend: 'ibm_test_qpu',
          program: { id: 'sampler' },
          state: { status: 'Completed', reason: '' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (href === 'https://quantum.example.test/api/v1/jobs/job-123/results') {
      return new Response(
        JSON.stringify({
          results: [{ data: { c: { samples: ['0x0', '0x3'] } }, metadata: null }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (href === 'https://quantum.example.test/api/v1/jobs/job-123/metrics') {
      return new Response(
        JSON.stringify({
          timestamps: {
            created: '2026-09-30T00:00:00Z',
            running: '2026-09-30T00:00:02Z',
            finished: '2026-09-30T00:00:06Z',
          },
          usage: { qpu_charge_time_seconds: 4, status: 'complete' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  };

  const runtime = createQuantumRuntime({
    env: {
      AETHERGRID_QUANTUM_PROVIDER: 'ibm-quantum',
      AETHERGRID_IBM_QUANTUM_BASE_URL: 'https://quantum.example.test/api/v1/',
      AETHERGRID_IBM_IAM_URL: 'https://iam.example.test/token',
      AETHERGRID_IBM_QUANTUM_API_KEY: 'test-api-key',
      AETHERGRID_IBM_QUANTUM_SERVICE_CRN: 'crn:test:quantum',
      AETHERGRID_IBM_QUANTUM_BACKEND: 'ibm_test_qpu',
    },
    fetchImpl,
    now: () => '2026-09-30T00:00:00.000Z',
  });

  const summary = runtime.summary();
  assert.equal(summary.provider, 'ibm-quantum');
  assert.equal(summary.configured, true);
  assert.equal(summary.credentialsExposed, false);
  assert.doesNotMatch(JSON.stringify(summary), /test-api-key|test-bearer/u);

  const backends = await runtime.listBackends();
  assert.equal(backends.backends[0].name, 'ibm_test_qpu');
  assert.equal(backends.backends[0].status, 'online');
  assert.equal(backends.backends[0].simulator, false);
  assert.equal(backends.backends[0].pendingJobs, 2);
  assert.equal(backends.backends[0].qubits, 127);

  const submitted = await runtime.submitSampler({
    backend: 'ibm_test_qpu',
    shots: 2048,
  });
  assert.equal(submitted.id, 'job-123');
  assert.equal(submitted.provider, 'ibm-quantum');
  assert.equal(submitted.hardwareSubmitted, true);
  assert.equal(submitted.hardwareExecuted, false);
  assert.match(submitted.receipt, /^[a-f0-9]{64}$/u);

  const estimator = await runtime.submitEstimator({
    backend: 'ibm_test_qpu',
    circuit: 'OPENQASM 3.0; include "stdgates.inc"; qubit[2] q; h q[0]; cx q[0], q[1];',
    observable: 'ZZ',
  });
  assert.equal(estimator.id, 'job-estimator-456');
  assert.equal(estimator.provider, 'ibm-quantum');
  assert.equal(estimator.programId, 'estimator');
  assert.equal(estimator.observable, 'ZZ');
  assert.equal(estimator.hardwareSubmitted, true);
  assert.equal(estimator.hardwareExecuted, false);
  assert.match(estimator.receipt, /^[a-f0-9]{64}$/u);

  const jobs = await runtime.listJobs();
  assert.equal(jobs.jobs[0].id, 'job-123');
  assert.equal(jobs.jobs[0].programId, 'sampler');
  assert.equal(jobs.jobs[0].status, 'Queued');

  const detail = await runtime.job('job-123');
  assert.equal(detail.status, 'Completed');
  assert.equal(detail.hardwareExecuted, true);

  const results = await runtime.jobResults('job-123');
  assert.deepEqual(results.result.results[0].data.c.samples, ['0x0', '0x3']);

  const metrics = await runtime.jobMetrics('job-123');
  assert.equal(metrics.metrics.usage.qpu_charge_time_seconds, 4);

  const iamRequests = requests.filter(
    (request) => request.href === 'https://iam.example.test/token',
  );
  assert.equal(iamRequests.length, 1, 'IAM token should be cached across provider calls');
});

test('local quantum sampler remains usable with no cloud credentials', async () => {
  const runtime = createQuantumRuntime({
    env: { AETHERGRID_QUANTUM_PROVIDER: 'local-simulator' },
  });
  const result = await runtime.submitSampler({ shots: 1000 });
  assert.equal(result.provider, 'local-simulator');
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.hardwareExecuted, false);
  assert.equal(result.distribution['00'] + result.distribution['11'], 1000);
  assert.match(result.receipt, /^[a-f0-9]{64}$/u);
});

test('local quantum estimator provides a bounded analytic fallback with explicit provenance', async () => {
  const runtime = createQuantumRuntime({
    env: { AETHERGRID_QUANTUM_PROVIDER: 'local-simulator' },
  });
  const result = await runtime.submitEstimator({
    circuit: 'OPENQASM 3.0; include "stdgates.inc"; qubit[2] q; h q[0]; cx q[0], q[1];',
    observable: 'ZZ',
  });
  assert.equal(result.provider, 'local-simulator');
  assert.equal(result.programId, 'estimator');
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.observable, 'ZZ');
  assert.equal(result.expectationValue, 1);
  assert.equal(result.hardwareExecuted, false);
  assert.equal(result.approximation, 'bounded-local-analytic-demo');
  assert.match(result.receipt, /^[a-f0-9]{64}$/u);
});
