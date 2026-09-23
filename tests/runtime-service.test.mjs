import assert from 'node:assert/strict';
import test from 'node:test';

import { createRuntimeLogger, validateRuntimeStatus } from '../src/runtime-observability.mjs';
import { startRuntimeService } from '../src/runtime-service.mjs';

async function withRuntimeService(run) {
  const logger = createRuntimeLogger({
    enabled: false,
  });
  const server = await startRuntimeService({
    host: '127.0.0.1',
    port: 0,
    logger,
    version: '0.1.0-test',
    now: () => new Date('2026-09-23T21:00:00.000Z'),
    uptime: () => 42,
  });

  const address = server.address();
  assert.equal(typeof address, 'object');
  assert.ok(address);
  const origin = `http://127.0.0.1:${address.port}`;

  try {
    await run(origin);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test('health endpoint is compact and status endpoint exposes validated runtime state', async () => {
  await withRuntimeService(async (origin) => {
    const healthResponse = await fetch(`${origin}/health`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), {
      service: 'thergrid',
      status: 'ok',
    });

    const statusResponse = await fetch(`${origin}/status`);
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.equal(status.version, '0.1.0-test');
    assert.equal(status.uptimeSeconds, 42);
    assert.equal(status.timestamp, '2026-09-23T21:00:00.000Z');
    assert.equal(validateRuntimeStatus(status), true);
  });
});

test('runtime service rejects unsupported methods and unknown paths', async () => {
  await withRuntimeService(async (origin) => {
    const methodResponse = await fetch(`${origin}/health`, {
      method: 'POST',
    });
    assert.equal(methodResponse.status, 405);
    assert.equal(methodResponse.headers.get('allow'), 'GET');
    assert.deepEqual(await methodResponse.json(), {
      error: 'method_not_allowed',
    });

    const missingResponse = await fetch(`${origin}/missing`);
    assert.equal(missingResponse.status, 404);
    assert.deepEqual(await missingResponse.json(), {
      error: 'not_found',
    });
  });
});

test('runtime service validates listen options before binding', async () => {
  await assert.rejects(
    startRuntimeService({
      port: -1,
      logger: createRuntimeLogger({ enabled: false }),
    }),
    /port must be an integer/iu,
  );

  await assert.rejects(
    startRuntimeService({
      host: '',
      logger: createRuntimeLogger({ enabled: false }),
    }),
    /host must be a non-empty string/iu,
  );
});
