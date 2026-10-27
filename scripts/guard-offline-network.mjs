// Loaded before credential-free tests. Fixture HTTP on loopback is allowed;
// TCP/TLS connections and fetches to external hosts are rejected before dialing.
import { Socket } from 'node:net';

const loopback = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0:0:0:0:0:0:0:1']);
const originalConnect = Socket.prototype.connect;

function assertLoopback(host) {
  if (loopback.has(String(host || 'localhost').toLowerCase())) return;
  throw new Error(`offline_test_network_blocked: ${host}`);
}

Socket.prototype.connect = function guardedConnect(...args) {
  let options = args[0];
  if (Array.isArray(options)) [options] = options;
  if (typeof options === 'number' || (typeof options === 'string' && /^\d+$/u.test(options))) {
    assertLoopback(typeof args[1] === 'string' ? args[1] : 'localhost');
  } else if (options && typeof options === 'object') {
    // Unix-domain sockets use `path` and do not leave the host.
    if (!options.path) assertLoopback(options.host || options.hostname || 'localhost');
  }
  return originalConnect.apply(this, args);
};

if (typeof globalThis.fetch === 'function') {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function guardedFetch(input, init) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      assertLoopback(url.hostname);
    } catch (error) {
      return Promise.reject(error);
    }
    return originalFetch.call(this, input, init);
  };
}
