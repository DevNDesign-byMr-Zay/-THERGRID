import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createGeoRuntime } from '../apps/aethergrid-console/geo-runtime.mjs';
import { createProfileStore } from '../apps/aethergrid-console/profile-store.mjs';
import { API_VERSION, createQuantumRuntime } from '../apps/aethergrid-console/quantum-runtime.mjs';

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
    { lat: 40.7127, lon: -74.0061 },
    { lat: 40.7127, lon: -74.0059 },
    { lat: 40.7129, lon: -74.0059 },
    { lat: 40.7129, lon: -74.0061 },
    { lat: 40.7127, lon: -74.0061 },
  ];
  const fetchImpl = async (url, options) => {
    calls += 1;
    assert.equal(String(url), 'https://example.test/overpass');
    assert.equal(options.method, 'POST');
    assert.match(String(options.headers['user-agent']), /AETHERGRID/u);
    return new Response(
      JSON.stringify({
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
            id: 2001,
            tags: { highway: 'primary', name: 'Test Avenue' },
            geometry: geometry.slice(0, 3),
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
  assert.equal(first.roads.length, 1);
  assert.equal(first.roads[0].name, 'Test Avenue');
  assert.equal(first.roads[0].highwayType, 'primary');
  assert.ok(first.roads[0].path.length >= 2);
  assert.equal(first.source.attribution, '© OpenStreetMap contributors');

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
        JSON.stringify([{ name: 'ibm_test_qpu', status: 'online', pending_jobs: 2 }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (href === 'https://quantum.example.test/api/v1/jobs' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.program_id, 'sampler');
      assert.equal(body.backend, 'ibm_test_qpu');
      assert.equal(body.params.version, 2);
      assert.match(body.params.pubs[0][0], /^OPENQASM 3\.0;/u);
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
              program_id: 'sampler',
              status: 'Queued',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (href === 'https://quantum.example.test/api/v1/jobs/job-123') {
      return new Response(JSON.stringify({ id: 'job-123', status: 'Completed' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
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

  const submitted = await runtime.submitSampler({
    backend: 'ibm_test_qpu',
    shots: 2048,
  });
  assert.equal(submitted.id, 'job-123');
  assert.equal(submitted.provider, 'ibm-quantum');
  assert.equal(submitted.hardwareSubmitted, true);
  assert.equal(submitted.hardwareExecuted, false);
  assert.match(submitted.receipt, /^[a-f0-9]{64}$/u);

  const jobs = await runtime.listJobs();
  assert.equal(jobs.jobs[0].id, 'job-123');
  assert.equal((await runtime.job('job-123')).status, 'Completed');

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
