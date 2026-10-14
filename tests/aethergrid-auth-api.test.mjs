import test from 'node:test';
import assert from 'node:assert/strict';

import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassword } from '../apps/aethergrid-console/security/session-runtime.mjs';
import { createObservationStore } from '../apps/aethergrid-console/observation-store.mjs';

test('HTTP sign-in, authorization, CSRF, recorded playback and logout', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'aethergrid-auth-api-'));
  const users = ['Viewer', 'Analyst', 'Administrator'].map((role) => ({
    username: role.toLowerCase(),
    role,
    passwordHash: hashPassword('a test password 123'),
  }));
  const observedAt = new Date(Date.now() - 60000).toISOString();
  const cursor = new Date().toISOString();
  const record = await createObservationStore({ dataDir }).record({
    kind: 'weather',
    coordinate: { lat: 40.7, lon: -74 },
    observedAt,
    payload: { source: { live: true, provider: 'test-fixture' }, current: { temperatureC: 20 } },
  });
  process.env.AETHERGRID_AUTH_USERS = JSON.stringify(users);
  process.env.AETHERGRID_AUTH_REQUIRED = '1';
  process.env.AETHERGRID_DATA_DIR = dataDir;
  const { server } = await import('../apps/aethergrid-console/server.mjs');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const error = '';

  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(base + '/api/aethergrid/health')).ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal((await fetch(base + '/api/aethergrid/state')).status, 401, error);
    const signIn = async (username) => {
      const response = await fetch(base + '/api/aethergrid/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password: 'a test password 123' }),
      });
      assert.equal(response.status, 200);
      return {
        cookie: response.headers.get('set-cookie').split(';')[0],
        ...(await response.json()),
      };
    };
    const viewer = await signIn('viewer');
    const vh = {
      cookie: viewer.cookie,
      'x-aethergrid-csrf': viewer.csrf,
      'content-type': 'application/json',
    };
    assert.equal((await fetch(base + '/api/aethergrid/state', { headers: vh })).status, 200);
    assert.equal(
      (await fetch(base + '/api/aethergrid/team', { method: 'POST', headers: vh, body: '{}' }))
        .status,
      403,
    );
    const analyst = await signIn('analyst');
    const ah = {
      cookie: analyst.cookie,
      'x-aethergrid-csrf': analyst.csrf,
      'content-type': 'application/json',
    };
    assert.equal(
      (
        await fetch(base + '/api/aethergrid/team', {
          method: 'POST',
          headers: { cookie: analyst.cookie },
          body: '{}',
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base + '/api/aethergrid/reset', { method: 'POST', headers: ah, body: '{}' }))
        .status,
      403,
    );
    const history = await fetch(
      base + `/api/aethergrid/weather/current?lat=40.7&lon=-74&at=${encodeURIComponent(cursor)}`,
      { headers: ah },
    );
    assert.equal(history.status, 200);
    assert.equal(history.headers.get('x-aethergrid-observation'), record.receipt);
    const team = await fetch(base + '/api/aethergrid/team', {
      method: 'POST',
      headers: ah,
      body: JSON.stringify({
        message: 'Review weather',
        context: { coordinate: { latitude: 40.7, longitude: -74 } },
      }),
    });
    assert.equal(team.status, 200);
    assert.equal((await team.json()).citations[0].receipt, record.receipt);
    const sessionResponse = await fetch(base + '/api/aethergrid/auth/session', { headers: ah });
    assert.equal((await sessionResponse.json()).user.username, 'analyst');
    assert.equal(
      (
        await fetch(base + '/api/aethergrid/auth/logout', {
          method: 'POST',
          headers: { cookie: analyst.cookie },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + '/api/aethergrid/team', {
          method: 'POST',
          headers: { ...ah, origin: 'https://untrusted.example' },
          body: '{}',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(
          base +
            '/api/aethergrid/history?lat=40.7&lon=-74&kind=weather&at=' +
            encodeURIComponent(cursor),
          { headers: ah },
        )
      ).status,
      200,
    );
    assert.equal(
      (await fetch(base + '/api/aethergrid/history?at=invalid', { headers: ah })).status,
      400,
    );
    assert.equal(
      (
        await fetch(
          base + '/api/aethergrid/weather/current?lat=0&lon=0&at=' + encodeURIComponent(cursor),
          { headers: ah },
        )
      ).status,
      404,
    );
    const profile = await fetch(base + '/api/aethergrid/profile', {
      method: 'PUT',
      headers: ah,
      body: JSON.stringify({ displayName: 'Analyst private profile' }),
    });
    assert.equal(profile.status, 200);
    assert.equal(
      (await (await fetch(base + '/api/aethergrid/profile', { headers: vh })).json()).profile
        .displayName,
      'Operator',
    );
    const individual = await fetch(base + '/api/aethergrid/agents/AUREN', {
      method: 'POST',
      headers: ah,
      body: JSON.stringify({
        message: 'Inspect recorded context',
        context: {
          coordinate: { latitude: 40.7, longitude: -74 },
          temporalMode: 'historical',
          temporalCursor: cursor,
        },
      }),
    });
    assert.equal(individual.status, 200);
    assert.equal((await individual.json()).citations[0].receipt, record.receipt);
    for (let i = 0; i < 20; i++)
      await fetch(base + '/api/aethergrid/team', { method: 'POST', headers: ah, body: '{}' });
    assert.equal(
      (await fetch(base + '/api/aethergrid/team', { method: 'POST', headers: ah, body: '{}' }))
        .status,
      429,
    );
    const audit = await readFile(join(dataDir, 'operator-audit.jsonl'), 'utf8');
    assert.match(audit, /analyst/);
    assert.doesNotMatch(audit, /a test password/);
    assert.equal(
      (await fetch(base + '/api/aethergrid/auth/logout', { method: 'POST', headers: ah })).status,
      200,
    );
    assert.equal((await fetch(base + '/api/aethergrid/state', { headers: ah })).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
});
