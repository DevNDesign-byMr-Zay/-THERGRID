import assert from 'node:assert/strict';
import { test } from 'node:test';

test('local optimization HTTP endpoint computes actual CPU reference without cloud calls', async () => {
  const { server } = await import('../apps/aethergrid-console/server.mjs');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const options = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        linear: [-2, -1],
        quadratic: [[0, 3], [0, 0]],
        iterations: 200,
        seed: 42,
      }),
    };
    const response = await fetch(origin + '/api/aethergrid/quantum/optimization/local', options);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.result.provider, 'aethergrid-local-cpu');
    assert.equal(payload.result.executionType, 'classical-cpu');
    assert.equal(payload.result.hardwareSubmitted, false);
    assert.equal(payload.result.hardwareExecuted, false);
    assert.equal(payload.result.exact.objective, -2);
    assert.deepEqual(payload.result.exact.bits, [1, 0]);
    assert.match(payload.result.receipt, /^[a-f0-9]{64}$/u);
    const repeat = await fetch(origin + '/api/aethergrid/quantum/optimization/local', options);
    assert.deepEqual((await repeat.json()).result, payload.result);

    const bad = await fetch(origin + '/api/aethergrid/quantum/optimization/local', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ linear: [1], quadratic: [[2]] }),
    });
    assert.equal(bad.status, 400);
    const error = await bad.json();
    assert.equal(error.error, 'invalid_qubo_problem');
    assert.match(error.message, /upper-triangle|diagonal/u);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
