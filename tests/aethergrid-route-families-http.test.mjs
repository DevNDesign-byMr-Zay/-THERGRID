import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { hashPassword } from '../apps/aethergrid-console/security/session-runtime.mjs';

// Characterize the entry point using real sockets, runtime adapters, storage and sessions.
// Removing any route family, bypassing authorization or losing the shared city/observation
// state must change these responses rather than merely satisfying a source-text assertion.
test('HTTP route families retain their shared security, evidence and lifecycle contracts', async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'aethergrid-route-families-'));
  const upstreamRequests = [];
  const upstream = http.createServer((request, response) => {
    upstreamRequests.push(request.url);
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ current: { temperature_2m: 23, is_day: 1 } }));
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const settings = {
    AETHERGRID_AUTH_REQUIRED: '1',
    AETHERGRID_AUTH_USERS: JSON.stringify([
      {
        username: 'operator',
        role: 'Administrator',
        passwordHash: hashPassword('route-family-password'),
      },
      { username: 'reviewer', role: 'Viewer', passwordHash: hashPassword('route-family-password') },
    ]),
    AETHERGRID_DATA_DIR: dataDir,
    AETHERGRID_AI_PROVIDER: 'local',
    AETHERGRID_GEO_PROVIDER: 'disabled-for-test',
    AETHERGRID_ENVIRONMENT_PROVIDER: 'open-meteo',
    AETHERGRID_OPEN_METEO_URL: `http://127.0.0.1:${upstream.address().port}/forecast`,
  };
  const prior = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.assign(process.env, settings);
  const { server, state, spatialGraph, CITY_USE_CASES, analyzeCityUseCase, cityMeshMetrics } =
    await import('../apps/aethergrid-console/server.mjs');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let headers;
  const get = (path, options = {}) => fetch(origin + path, { headers, ...options });
  const post = (path, input, options = {}) =>
    get(path, {
      method: 'POST',
      body: JSON.stringify(input),
      ...options,
    });
  try {
    await t.test(
      'authentication precedes routes and the file bridge remains narrowly scoped',
      async () => {
        assert.equal((await get('/api/aethergrid/state')).status, 401);
        const health = await get('/api/aethergrid/health', { headers: { origin: 'null' } });
        assert.equal(health.status, 200);
        assert.equal(health.headers.get('access-control-allow-origin'), 'null');
        assert.equal((await health.json()).authority, 'advisory-only');
        const preflight = await get('/api/aethergrid/domains/aviation/aircraft', {
          method: 'OPTIONS',
          headers: { origin: 'null' },
        });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
        const otherPreflight = await get('/api/aethergrid/state', {
          method: 'OPTIONS',
          headers: { origin: 'null' },
        });
        assert.equal(otherPreflight.status, 403);
        assert.equal(otherPreflight.headers.get('access-control-allow-origin'), null);
        const login = await post('/api/aethergrid/auth/login', {
          username: 'operator',
          password: 'route-family-password',
        });
        assert.equal(login.status, 200);
        const session = await login.json();
        headers = {
          cookie: login.headers.get('set-cookie').split(';')[0],
          'x-aethergrid-csrf': session.csrf,
          'content-type': 'application/json',
        };
        assert.equal(
          (await (await get('/api/aethergrid/auth/session')).json()).user.username,
          'operator',
        );
        const rejected = await post(
          '/api/aethergrid/view',
          { view: 'live' },
          {
            headers: { ...headers, origin: 'https://untrusted.example' },
          },
        );
        assert.equal(rejected.status, 403);
        assert.deepEqual(await rejected.json(), { error: 'origin_rejected' });
        assert.equal(
          (
            await post(
              '/api/aethergrid/view',
              { view: 'live' },
              {
                headers: { cookie: headers.cookie },
              },
            )
          ).status,
          403,
        );
      },
    );

    await t.test(
      'provider observations are persisted and replayed with the original receipt',
      async () => {
        const current = await get('/api/aethergrid/environment?lat=40.7&lon=-74');
        assert.equal(current.status, 200);
        const payload = await current.json();
        assert.equal(payload.current.temperatureC, 23);
        assert.equal(payload.source.live, true);
        assert.equal(upstreamRequests.length, 1);
        const receipt = current.headers.get('x-aethergrid-observation');
        assert.match(receipt, /^[a-f0-9]{64}$/u);
        const cursor = encodeURIComponent(new Date().toISOString());
        const replay = await get(`/api/aethergrid/environment?lat=40.7&lon=-74&at=${cursor}`);
        assert.equal(replay.status, 200);
        assert.equal(replay.headers.get('x-aethergrid-observation'), receipt);
        assert.ok(replay.headers.get('x-aethergrid-recorded-at'));
        assert.deepEqual(await replay.json(), payload);
        assert.equal(upstreamRequests.length, 1);
        const history = await (
          await get(`/api/aethergrid/history?kind=environment&lat=40.7&lon=-74&at=${cursor}`)
        ).json();
        assert.equal(history.observations[0].receipt, receipt);
        assert.equal(history.interpolated, false);
        const invalid = await get('/api/aethergrid/weather/current?lat=&lon=-74');
        assert.equal(invalid.status, 400);
        assert.equal((await invalid.json()).error, 'invalid_coordinates');
      },
    );

    await t.test(
      'spatial selection and background tiles keep city analysis and exports coherent',
      async () => {
        assert.equal(typeof analyzeCityUseCase, 'function');
        assert.equal(typeof cityMeshMetrics, 'function');
        assert.ok(Object.keys(CITY_USE_CASES).length > 0);
        assert.ok(spatialGraph.nodes.length > 0);
        const selected = await (
          await get('/api/aethergrid/geospatial/city/new-york?spatial=1')
        ).json();
        assert.equal(selected.city.id, 'new-york');
        const tile = await get(
          '/api/aethergrid/geospatial/point?lat=40.76&lon=-73.97&spatial=1&tile=1',
        );
        assert.equal(tile.status, 200);
        const cases = await (await get('/api/aethergrid/city-operations/use-cases')).json();
        assert.equal(cases.activeCity.id, 'new-york');
        const analyzed = await post('/api/aethergrid/city-operations/analyze', {
          useCaseId: 'grid-resilience',
        });
        assert.equal(analyzed.status, 200);
        const analysis = await analyzed.json();
        assert.equal(analysis.analysis.city.id, 'new-york');
        assert.equal(analysis.evidence.receipt, analysis.analysis.receipt);
        assert.equal(state.externalContext.geospatial.useCase.receipt, analysis.analysis.receipt);
        const evidence = await (
          await get(`/api/aethergrid/evidence/${analysis.evidence.receipt}`)
        ).json();
        assert.equal(evidence.evidence.type, 'CITY_OPERATION');
        const spatial = await (await get('/api/aethergrid/spatial?hour=999')).json();
        assert.equal(spatial.timeHour, 24);
      },
    );

    await t.test('streaming emits a real telemetry frame and accepts cancellation', async () => {
      const controller = new AbortController();
      const stream = await get('/api/aethergrid/stream', { signal: controller.signal });
      assert.equal(stream.status, 200);
      assert.match(stream.headers.get('content-type'), /^text\/event-stream/u);
      const reader = stream.body.getReader();
      const { value } = await reader.read();
      const frame = new TextDecoder().decode(value);
      assert.match(frame, /^event: telemetry\ndata: /u);
      const event = JSON.parse(frame.split('data: ')[1].trim());
      assert.equal(event.state.system.region, state.system.region);
      assert.ok(Number.isFinite(event.state.metrics.generationMw));
      controller.abort();
      await reader.cancel().catch(() => {});
      assert.equal((await get('/api/aethergrid/telemetry')).status, 200);
    });

    await t.test(
      'agent advisory boundaries and quantum CPU results survive route dispatch',
      async () => {
        const agent = await post('/api/aethergrid/agents/AUREN', {
          message: 'Review recorded context',
          context: { coordinate: { latitude: 40.7, longitude: -74 } },
        });
        assert.equal(agent.status, 200);
        const advisory = await agent.json();
        assert.equal(advisory.evidence.status, 'LOCAL_FALLBACK');
        assert.equal(advisory.advisoryOnly, true);
        assert.equal(advisory.citations[0].kind, 'environment');
        assert.equal(advisory.evidence.details.scenario, state.system.scenario);
        const invalidAgent = await post('/api/aethergrid/chat', {
          agent: 'unknown',
          message: 'Review',
        });
        assert.equal(invalidAgent.status, 400);
        const quantum = await post('/api/aethergrid/quantum/optimization/local', {
          linear: [-2, -1],
          quadratic: [
            [0, 3],
            [0, 0],
          ],
          seed: 42,
          iterations: 20,
        });
        assert.equal(quantum.status, 200);
        const { result } = await quantum.json();
        assert.equal(result.exact.objective, -2);
        assert.deepEqual(result.exact.bits, [1, 0]);
        assert.equal(result.hardwareSubmitted, false);
        const submission = await post('/api/aethergrid/quantum/dwave/jobs', {});
        assert.equal(submission.status, 400);
        assert.equal((await submission.json()).error, 'confirmation_required');
        const stringConfirmation = await post('/api/aethergrid/quantum/dwave/jobs', {
          confirmSubmission: 'true',
          solver: 'fixture',
          problemType: 'qubo',
          problemPayload: { fixture: true },
        });
        assert.equal(stringConfirmation.status, 400);
        assert.equal((await stringConfirmation.json()).error, 'confirmation_required');
        assert.equal((await get('/api/aethergrid/quantum/dwave/jobs')).status, 400);
        assert.equal((await get('/api/aethergrid/quantum/jobs/id/unsupported')).status, 404);
      },
    );

    await t.test(
      'body limits, profile storage errors and route fallthrough retain safe responses',
      async () => {
        const malformed = await post('/api/aethergrid/view', {}, { body: '{' });
        assert.equal(malformed.status, 400);
        assert.equal((await malformed.json()).message, 'invalid JSON request body');
        const tooLarge = await post('/api/aethergrid/view', { value: 'x'.repeat(250_001) });
        assert.equal(tooLarge.status, 413);
        await writeFile(join(dataDir, 'profiles'), 'private-storage-detail');
        const profile = await get('/api/aethergrid/profile', {
          method: 'PUT',
          body: JSON.stringify({ displayName: 'Operator' }),
        });
        assert.equal(profile.status, 500);
        assert.deepEqual(await profile.json(), {
          error: 'server_error',
          message: 'Internal server error',
        });
        assert.equal((await get('/api/aethergrid/unknown')).status, 404);
        assert.equal((await get('/api/aethergrid/unknown', { method: 'DELETE' })).status, 405);
        assert.equal((await get('/api/aethergrid/state', { method: 'HEAD' })).status, 404);
        await rm(join(dataDir, 'observations-v1'), { recursive: true });
        await writeFile(join(dataDir, 'observations-v1'), 'unavailable');
        const persistence = await get('/api/aethergrid/environment?lat=41&lon=-74');
        assert.equal(persistence.status, 503);
        assert.deepEqual(await persistence.json(), { error: 'observation_storage_unavailable' });
        const audit = await readFile(join(dataDir, 'operator-audit.jsonl'), 'utf8');
        assert.match(audit, /"operator":"operator"/u);
        assert.doesNotMatch(audit, /route-family-password|private-storage-detail/u);
      },
    );

    await t.test('operator quotas and logout still apply across agent endpoints', async () => {
      for (let count = 0; count < 20; count++) await post('/api/aethergrid/team', {});
      const quota = await post('/api/aethergrid/chat', { message: 'Review' });
      assert.equal(quota.status, 429);
      assert.deepEqual(await quota.json(), { error: 'operator_request_quota' });
      assert.equal((await post('/api/aethergrid/auth/logout', {})).status, 200);
      assert.equal((await get('/api/aethergrid/state')).status, 401);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => upstream.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
