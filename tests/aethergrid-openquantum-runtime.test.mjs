import assert from 'node:assert/strict';
import test from 'node:test';
import { createOpenQuantumRuntime } from '../apps/aethergrid-console/openquantum-runtime.mjs';

test('Open Quantum remains optional; discovery does not need IBM or a remote call', async () => {
  const runtime = createOpenQuantumRuntime({
    env: {},
    runWorker: async () => {
      throw new Error('must not run');
    },
  });
  assert.equal(runtime.summary().status, 'unconfigured');
  assert.equal(runtime.summary().hardwareExecuted, false);
  assert.deepEqual((await runtime.listBackends()).backends, []);
});

test('SDK JSON key config is never sent to public results', async () => {
  const secret = 'synthetic-unit-test-secret';
  const env = {
    AETHERGRID_OPENQUANTUM_SDK_KEY_JSON: JSON.stringify({
      client_id: 'fake-id',
      client_secret: secret,
    }),
  };
  const runtime = createOpenQuantumRuntime({
    env,
    runWorker: async (action) => {
      assert.equal(action, 'backends');
      return {
        status: 'ready',
        live: true,
        backends: [
          {
            name: 'Fixture QPU',
            shortCode: 'test:fixture',
            type: 'QPU',
            status: 'Online',
            acceptingJobs: true,
            queueDepth: 0,
            client_secret: secret,
          },
        ],
      };
    },
  });
  const result = await runtime.listBackends();
  assert.equal(result.live, true);
  assert.equal(result.backends.length, 1);
  assert.equal(result.hardwareSubmitted, false);
  assert.equal(result.hardwareExecuted, false);
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(!JSON.stringify(runtime.summary()).includes(secret));
});

test('Configured does not imply hardware readiness or execution', async () => {
  const runtime = createOpenQuantumRuntime({
    env: { OPENQUANTUM_CLIENT_ID: 'fake-id', OPENQUANTUM_CLIENT_SECRET: 'fake-secret' },
    runWorker: async () => ({
      status: 'unavailable',
      backends: [],
      hardwareExecuted: true,
    }),
  });
  assert.equal(runtime.summary().status, 'configured');
  const result = await runtime.listBackends();
  assert.equal(result.status, 'unavailable');
  assert.equal(result.hardwareExecuted, false);
  assert.equal(result.live, false);
});

test('Read-only status exposes SDK metadata only', async () => {
  const runtime = createOpenQuantumRuntime({
    env: {},
    runWorker: async () => ({
      status: 'sdk_missing',
      sdkInstalled: false,
      diagnostic: 'fake-secret',
    }),
  });
  const result = await runtime.status();
  assert.equal(result.status, 'sdk_missing');
  assert.ok(!JSON.stringify(result).includes('fake-secret'));
});
