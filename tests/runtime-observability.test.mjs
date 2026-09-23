import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRuntimeStatus,
  createRuntimeLogger,
  parseRuntimeConfig,
  validateRuntimeStatus,
} from '../src/runtime-observability.mjs';

test('runtime config validates port and structured log level', () => {
  assert.deepEqual(
    parseRuntimeConfig({
      THERGRID_PORT: '9090',
      THERGRID_LOG_LEVEL: 'debug',
    }),
    {
      port: 9090,
      logLevel: 'debug',
    },
  );

  assert.throws(
    () => parseRuntimeConfig({ THERGRID_PORT: '70000' }),
    /Too big|less than or equal|maximum|65535/iu,
  );
  assert.throws(
    () => parseRuntimeConfig({ THERGRID_LOG_LEVEL: 'verbose' }),
    /Invalid option|invalid/iu,
  );
});

test('runtime logger carries explicit service identity and level', () => {
  const logger = createRuntimeLogger({
    service: 'thergrid-test',
    level: 'warn',
    enabled: false,
  });

  assert.equal(logger.level, 'warn');
  assert.equal(logger.bindings().service, 'thergrid-test');
});

test('runtime status is schema-valid, bounded, and immutable', () => {
  const status = buildRuntimeStatus({
    version: '0.1.0-test',
    status: 'ok',
    uptimeSeconds: 12.5,
    timestamp: '2026-09-23T20:45:00.000Z',
  });

  assert.equal(validateRuntimeStatus(status), true);
  assert.equal(status.service, 'thergrid');
  assert.equal(status.checks.runtime, 'available');
  assert.equal(Object.isFrozen(status), true);
  assert.equal(Object.isFrozen(status.checks), true);

  assert.equal(
    validateRuntimeStatus({
      ...status,
      uptimeSeconds: -1,
    }),
    false,
  );
});

test('degraded status remains explicit instead of masquerading as healthy', () => {
  const status = buildRuntimeStatus({
    status: 'degraded',
    uptimeSeconds: 1,
    timestamp: '2026-09-23T20:45:00.000Z',
  });

  assert.equal(status.status, 'degraded');
  assert.equal(status.checks.runtime, 'degraded');
  assert.equal(validateRuntimeStatus(status), true);
});
