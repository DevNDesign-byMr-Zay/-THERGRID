import assert from 'node:assert/strict';
import { createServer, createConnection, Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import test from 'node:test';

import '../scripts/guard-offline-network.mjs';

test('offline test mode rejects remote TCP and TLS sockets before dialing', () => {
  assert.throws(
    () => new Socket().connect({ port: 443, host: '8.8.8.8' }),
    /offline_test_network_blocked/u,
  );
  assert.throws(
    () => tlsConnect({ port: 443, host: 'example.org' }),
    /offline_test_network_blocked/u,
  );
});

test('offline test mode permits local fixture sockets', async () => {
  const server = createServer((socket) => socket.end('ok'));
  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(0, '127.0.0.1', resolve),
  );
  try {
    const result = await new Promise((resolve, reject) => {
      const socket = createConnection(server.address().port, '127.0.0.1');
      let body = '';
      socket.on('data', (chunk) => (body += chunk.toString()));
      socket.on('end', () => resolve(body));
      socket.on('error', reject);
    });
    assert.equal(result, 'ok');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
