import assert from 'node:assert/strict';
import test from 'node:test';

test('optional Qiskit Aer HTTP boundary reports truth and never creates a hardware job', async (t) => {
  const { server } = await import('../apps/aethergrid-console/server.mjs');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetch(origin + '/api/aethergrid/quantum/qiskit/status');
    assert.equal(response.status, 200);
    const status = await response.json();
    assert.equal(status.provider, 'qiskit-aer');
    assert.equal(status.hardwareSubmitted, false);
    assert.equal(status.hardwareExecuted, false);

    const invalid = await fetch(origin + '/api/aethergrid/quantum/qiskit/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ experiment: 'bell', shots: 0 }),
    });
    assert.equal(invalid.status, 400);
    const error = await invalid.json();
    assert.equal(error.error, 'invalid-circuit-input');

    const malformed = await fetch(origin + '/api/aethergrid/quantum/qiskit/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(malformed.status, 400);

    if (!status.available) {
      const unavailable = await fetch(origin + '/api/aethergrid/quantum/qiskit/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ experiment: 'bell', shots: 128, seed: 17 }),
      });
      assert.equal(unavailable.status, 503);
      assert.equal((await unavailable.json()).error, 'qiskit-aer-not-installed');
      t.diagnostic('Aer not installed: verified truthful optional 503 response');
      return;
    }

    const actual = await fetch(origin + '/api/aethergrid/quantum/qiskit/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ experiment: 'bell', shots: 128, seed: 17 }),
    });
    assert.equal(actual.status, 200);
    const { result } = await actual.json();
    assert.equal(result.backend, 'aer-simulator-cpu');
    assert.equal(result.hardwareExecuted, false);
    assert.equal(result.hardwareSubmitted, false);
    assert.equal(Object.values(result.counts).reduce((sum, value) => sum + value, 0), 128);
    assert.deepEqual(Object.keys(result.counts).sort(), ['00', '11']);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
