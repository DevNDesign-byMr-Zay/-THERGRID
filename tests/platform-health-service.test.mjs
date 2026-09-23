import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
  createPlatformHealthServer,
  parseHealthServiceConfig,
} from '../src/platform-health-service.mjs';

test('parses bounded health service configuration', () => {
  assert.deepEqual(parseHealthServiceConfig({}), {
    PORT: 8080,
    SERVICE_NAME: 'thergrid',
  });
  assert.deepEqual(parseHealthServiceConfig({ PORT: '9090', SERVICE_NAME: 'grid-health' }), {
    PORT: 9090,
    SERVICE_NAME: 'grid-health',
  });
  assert.throws(() => parseHealthServiceConfig({ PORT: '70000' }));
});

test('serves health and status endpoints without Express', async (t) => {
  const messages = [];
  const logger = {
    info(data, message) {
      messages.push({ level: 'info', data, message });
    },
    warn(data, message) {
      messages.push({ level: 'warn', data, message });
    },
  };
  const server = createPlatformHealthServer({
    serviceName: 'thergrid-test',
    logger,
    startedAt: Date.now() - 2500,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());

  const address = server.address();
  assert.equal(typeof address, 'object');
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.service, 'thergrid-test');
  assert.equal(healthBody.status, 'ok');
  assert.ok(healthBody.uptimeSeconds >= 2);

  const status = await fetch(`${base}/status`);
  assert.equal(status.status, 200);

  const missing = await fetch(`${base}/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), {
    service: 'thergrid-test',
    status: 'not_found',
  });

  assert.equal(messages.filter((entry) => entry.level === 'info').length, 2);
  assert.equal(messages.filter((entry) => entry.level === 'warn').length, 1);
});
