import assert from 'node:assert/strict';
import { connect as netConnect, Socket } from 'node:net';
import test from 'node:test';

// Stub the actual dial *before* installing the guard. A failed regression
// assertion must never make a real external connection.
const original = Socket.prototype.connect;
const attempted = [];
Socket.prototype.connect = function recordConnect(...args) {
  attempted.push(args);
  return this;
};
// A distinct module URL reinstalls the wrapper even when the offline suite
// preloads the guard with NODE_OPTIONS before this test worker starts.
await import(new URL('../scripts/guard-offline-network.mjs?overload-regression', import.meta.url));

test('offline guard blocks numeric-string TCP overload without dialing', () => {
  assert.throws(() => new Socket().connect('443', 'example.org'), /offline_test_network_blocked/u);
  assert.equal(attempted.length, 0);
  assert.throws(
    () => netConnect({ port: 443, host: 'example.org' }),
    /offline_test_network_blocked/u,
  );
});

test('offline guard rejects remote fetch before dialing', async () => {
  await assert.rejects(fetch('https://example.org/'), /offline_test_network_blocked/u);
  assert.equal(attempted.length, 0);
});

test('offline guard preserves local numeric-string and Unix socket overloads', () => {
  new Socket().connect('8080', 'localhost');
  new Socket().connect('/tmp/aethergrid-local-fixture.sock');
  assert.equal(attempted.length, 2);
});

test.after(() => {
  Socket.prototype.connect = original;
});
