import assert from 'node:assert/strict';
import test from 'node:test';

import { createErrorReporter } from '../src/error-reporting.mjs';

test('reports runtime failures with bounded frozen context', () => {
  const reports = [];
  const reportError = createErrorReporter({
    onError(error, context) {
      reports.push({ error, context });
    },
  });
  const error = new Error('sensitive upstream detail');

  assert.equal(
    reportError(error, {
      scope: 'health-service-start',
      service: 'thergrid',
      port: 8080,
      ignored: 'not forwarded',
    }),
    true,
  );
  assert.equal(reports.length, 1);
  assert.equal(reports[0].error, error);
  assert.deepEqual(reports[0].context, {
    scope: 'health-service-start',
    service: 'thergrid',
    port: 8080,
  });
  assert.equal(Object.isFrozen(reports[0].context), true);
});

test('contains reporter failures without replacing the original runtime error', async () => {
  const warnings = [];
  const reportError = createErrorReporter({
    onError() {
      throw new Error('telemetry unavailable');
    },
    logger: {
      warn(metadata, message) {
        warnings.push({ metadata, message });
      },
    },
  });

  assert.equal(reportError(new Error('runtime failed'), { scope: 'health-service-start' }), false);
  assert.deepEqual(warnings, [
    {
      metadata: { event: 'error_reporter_failed', errorName: 'Error' },
      message: 'error reporter failed',
    },
  ]);
  assert.equal(JSON.stringify(warnings).includes('telemetry unavailable'), false);
});

test('supports asynchronous reporters and isolates rejected reporter promises', async () => {
  const warnings = [];
  const reportError = createErrorReporter({
    onError: async () => {
      throw new Error('async telemetry unavailable');
    },
    logger: {
      warn(metadata, message) {
        warnings.push({ metadata, message });
      },
    },
  });

  assert.equal(reportError(new Error('runtime failed'), { scope: 'health-service-start' }), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].metadata.event, 'error_reporter_failed');
});
