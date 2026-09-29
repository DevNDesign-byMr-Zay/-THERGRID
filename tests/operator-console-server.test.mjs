import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createOperatorConsoleServer,
  parseOperatorConsolePort,
} from '../src/operator-console-server.mjs';

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

test('operator console serves the ÆTHERGRID application shell', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/html/);
    const body = await response.text();
    assert.match(body, /ÆTHERGRID/);
    assert.match(body, /HOLOGRAPHIC/);
    assert.match(body, /QUANTUM/);
  });
});

test('operator console serves the read-only platform capability contract', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/capabilities`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.product, 'ÆTHERGRID');
    assert.equal(payload.safety.advisoryOnly, true);
    assert.equal(payload.safety.actuatesHardware, false);
    assert.equal(payload.quantum.classicalBaselineRequired, true);
    assert.ok(payload.holographic.supportedTargets.includes('web-dashboard'));
  });
});

test('operator console serves the holographic brand asset', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/assets/aethergrid-mark.svg`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^image\/svg\+xml/);
    assert.match(await response.text(), /quantum holographic grid mark/);
  });
});

test('operator console remains read-only over HTTP', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/capabilities`, { method: 'POST' });
    assert.equal(response.status, 405);
    assert.deepEqual(await response.json(), { status: 'method_not_allowed' });
  });
});

test('operator console returns bounded not-found responses', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/missing`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { status: 'not_found' });
  });
});

test('operator console port parsing is bounded', () => {
  assert.equal(parseOperatorConsolePort(undefined), 8090);
  assert.equal(parseOperatorConsolePort('9000'), 9000);
  assert.throws(() => parseOperatorConsolePort('0'), /1 through 65535/);
  assert.throws(() => parseOperatorConsolePort('not-a-port'), /1 through 65535/);
});
