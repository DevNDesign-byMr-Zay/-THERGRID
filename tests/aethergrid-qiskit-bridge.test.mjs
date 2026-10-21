import assert from 'node:assert/strict';
import test from 'node:test';
import { probeQiskitAer, runQiskitAer, AerBridgeError } from '../apps/aethergrid-console/qiskit-aer-runtime.mjs';

test('missing Python keeps Aer optional with explicit no-hardware evidence', async () => {
  const offline = await probeQiskitAer({ pythonExecutable: 'aethergrid-no-such-python' });
  assert.equal(offline.available, false);
  assert.equal(offline.provider, 'qiskit-aer');
  assert.equal(offline.hardwareSubmitted, false);
  assert.equal(offline.hardwareExecuted, false);
  assert.equal(offline.reason, 'python-unavailable');
});

test('explicit Aer run with unavailable Python rejects without falling back to fake circuit results', async () => {
  await assert.rejects(
    runQiskitAer({ experiment: 'bell', shots: 128, seed: 42 }, {
      pythonExecutable: 'aethergrid-no-such-python',
    }),
    (error) =>
      error instanceof AerBridgeError &&
      error.code === 'python-unavailable' &&
      error.status === 503,
  );
});

test('invalid input payload is rejected before spawning any optional Python worker', async () => {
  await assert.rejects(
    runQiskitAer({ experiment: 'bell', invalidText: 'x'.repeat(16_400) }, {
      pythonExecutable: 'aethergrid-no-such-python',
    }),
    (error) =>
      error instanceof AerBridgeError &&
      error.code === 'invalid-circuit-input' &&
      error.status === 400,
  );
});
