import assert from 'node:assert/strict';
import test from 'node:test';
import {
  probeQiskitAer,
  runQiskitAer,
  AerBridgeError,
} from '../apps/aethergrid-console/qiskit-aer-runtime.mjs';

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
    runQiskitAer(
      { experiment: 'bell', shots: 128, seed: 42 },
      {
        pythonExecutable: 'aethergrid-no-such-python',
      },
    ),
    (error) =>
      error instanceof AerBridgeError &&
      error.code === 'python-unavailable' &&
      error.status === 503,
  );
});

test('invalid input payload is rejected before spawning any optional Python worker', async () => {
  await assert.rejects(
    runQiskitAer(
      { experiment: 'bell', invalidText: 'x'.repeat(16_400) },
      {
        pythonExecutable: 'aethergrid-no-such-python',
      },
    ),
    (error) =>
      error instanceof AerBridgeError &&
      error.code === 'invalid-circuit-input' &&
      error.status === 400,
  );
});

test('circuit validation does not require an installed Python interpreter', async () => {
  for (const input of [
    null,
    [],
    {},
    { experiment: 'bell', shots: 0 },
    { experiment: 'bell', seed: -1 },
    { experiment: 'bell', unexpected: true },
    { experiment: 'qubo-qaoa', linear: Array(9).fill(0) },
    { experiment: 'qubo-qaoa', linear: [0], quadratic: [[1]] },
    { experiment: 'qubo-qaoa', linear: [Infinity] },
    { experiment: 'qubo-qaoa', linear: [0], beta: 4 },
  ]) {
    await assert.rejects(
      runQiskitAer(input, { pythonExecutable: 'aethergrid-no-such-python' }),
      (error) =>
        error instanceof AerBridgeError &&
        error.code === 'invalid-circuit-input' &&
        error.status === 400,
    );
  }
});

test('status probing and execution share the single optional worker budget', async () => {
  const options = { pythonExecutable: 'aethergrid-no-such-python-budget-test' };
  const probing = probeQiskitAer(options);
  try {
    await assert.rejects(
      runQiskitAer({ experiment: 'bell', shots: 128, seed: 17 }, options),
      (error) =>
        error instanceof AerBridgeError && error.code === 'simulator-busy' && error.status === 429,
    );
  } finally {
    await probing;
  }
});
