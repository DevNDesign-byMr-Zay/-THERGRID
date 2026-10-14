import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createSessionRuntime,
  hashPassword,
} from '../apps/aethergrid-console/security/session-runtime.mjs';
import { createObservationStore } from '../apps/aethergrid-console/observation-store.mjs';

test('sessions reject wrong passwords, enforce roles and CSRF, expire and revoke', async () => {
  let time = 1000;
  const auth = createSessionRuntime({
    env: {
      AETHERGRID_AUTH_USERS: JSON.stringify([
        { username: 'viewer', role: 'Viewer', passwordHash: hashPassword('a strong password') },
        {
          username: 'analyst',
          role: 'Analyst',
          passwordHash: hashPassword('another strong password'),
        },
      ]),
    },
    now: () => time,
  });
  assert.throws(() => auth.login('viewer', 'wrong'), /invalid_credentials/);
  const session = auth.login('viewer', 'a strong password');
  const req = { headers: { cookie: `aethergrid_session=${session.token}` } };
  assert.equal(auth.authorize(req, 'GET', '/api/aethergrid/state').user.role, 'Viewer');
  assert.throws(() => auth.authorize(req, 'POST', '/api/aethergrid/team'), /forbidden/);
  const analyst = auth.login('analyst', 'another strong password');
  const write = {
    headers: { cookie: `aethergrid_session=${analyst.token}`, 'x-aethergrid-csrf': analyst.csrf },
  };
  assert.equal(auth.authorize(write, 'POST', '/api/aethergrid/team').user.role, 'Analyst');
  delete write.headers['x-aethergrid-csrf'];
  assert.throws(() => auth.authorize(write, 'POST', '/api/aethergrid/team'), /csrf/);
  auth.logout(req);
  assert.throws(
    () => auth.authorize(req, 'GET', '/api/aethergrid/state'),
    /authentication_required/,
  );
  time += 9 * 60 * 60 * 1000;
  assert.throws(
    () => auth.authorize(write, 'GET', '/api/aethergrid/state'),
    /authentication_required/,
  );
});

test('observations survive restart, preserve receipts and never substitute future records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aethergrid-history-'));
  try {
    const store = createObservationStore({ dataDir: dir });
    const record = await store.record({
      kind: 'weather',
      coordinate: { lat: 40.7, lon: -74 },
      observedAt: '2026-10-14T07:00:00Z',
      payload: { source: { live: true, provider: 'Open-Meteo' }, current: { temperatureC: 20 } },
    });
    const restarted = createObservationStore({ dataDir: dir });
    const result = await restarted.replay({
      kind: 'weather',
      lat: 40.7,
      lon: -74,
      at: '2026-10-14T07:10:00Z',
    });
    assert.equal(result.receipt, record.receipt);
    assert.equal(result.payload.current.temperatureC, 20);
    assert.equal(
      await restarted.replay({ kind: 'weather', lat: 40.7, lon: -74, at: '2026-10-14T06:59:00Z' }),
      null,
    );
    assert.equal(
      await restarted.replay({ kind: 'weather', lat: 51, lon: 0, at: '2026-10-14T07:10:00Z' }),
      null,
    );
    await assert.rejects(
      store.record({
        kind: 'weather',
        coordinate: { lat: 40.7, lon: -74 },
        observedAt: 'invalid',
        payload: {},
      }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('authentication configuration fails closed and login throttles repeated attempts', () => {
  assert.throws(
    () => createSessionRuntime({ env: { AETHERGRID_AUTH_REQUIRED: '1' } }),
    /users required/,
  );
  assert.throws(
    () => createSessionRuntime({ env: { AETHERGRID_AUTH_USERS: '{}' } }),
    /invalid authentication/,
  );
  assert.throws(
    () =>
      createSessionRuntime({
        env: {
          AETHERGRID_AUTH_USERS: JSON.stringify([
            { username: '..', role: 'Viewer', passwordHash: hashPassword('a test password 123') },
          ]),
        },
      }),
    /invalid authentication/,
  );
  assert.throws(() => hashPassword('short'), /12/);
  const runtime = createSessionRuntime({ env: {}, now: () => 1000 });
  assert.equal(runtime.authorize({ headers: {} }, 'POST', '/api/aethergrid/team').localOnly, true);
  for (let i = 0; i < 8; i++)
    assert.throws(() => runtime.login('unknown', 'invalid', 'address'), /invalid_credentials/);
  assert.throws(() => runtime.login('unknown', 'invalid', 'address'), /login_rate_limited/);
  runtime.logout({ headers: {} });
});

test('archive rejects tampered observations and invalid cursors', async () => {
  const { writeFile } = await import('node:fs/promises');
  const dir = await mkdtemp(join(tmpdir(), 'aethergrid-integrity-'));
  try {
    const store = createObservationStore({ dataDir: dir });
    assert.deepEqual(await store.list(), []);
    await assert.rejects(store.list({ at: 'invalid' }), /invalid_history_cursor/);
    const record = await store.record({
      kind: 'weather',
      coordinate: { lat: 1, lon: 2 },
      payload: { value: 1 },
    });
    assert.equal((await store.list()).length, 1);
    await writeFile(
      join(dir, 'observations-v1', record.receipt + '.json'),
      JSON.stringify({ ...record, payload: { value: 2 } }),
    );
    await assert.rejects(store.list(), /integrity/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
