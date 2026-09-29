import assert from 'node:assert/strict';
import test from 'node:test';

import { createOperatorConsoleServer } from '../src/operator-console-server.mjs';

async function withServer(run) {
  const server = createOperatorConsoleServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('operator console exposes the validated evidence-driven operator state', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/operator-state`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^application\/json/u);

    const state = await response.json();
    assert.equal(state.source.kind, 'validated-synthetic-demo');
    assert.equal(state.source.liveTelemetry, false);
    assert.equal(state.twin.assetStates.length, 5);
    assert.equal(state.dashboard.items.length, 2);
    assert.equal(state.holographic.renderPacket.target, 'web-dashboard');
    assert.equal(state.safety.actuatesHardware, false);
  });
});

test('operator state endpoint rejects mutation methods', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/operator-state`, { method: 'POST' });
    assert.equal(response.status, 405);
    assert.deepEqual(await response.json(), { status: 'method_not_allowed' });
  });
});
