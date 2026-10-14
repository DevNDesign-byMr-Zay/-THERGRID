import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderConfig } from '../apps/aethergrid-console/config/provider-config.mjs';

test('application remains loopback-only unless container binding is explicitly requested', () => {
  assert.equal(createProviderConfig({}).app.bindAddress, '127.0.0.1');
  assert.equal(
    createProviderConfig({ AETHERGRID_BIND_ADDRESS: '0.0.0.0' }).app.bindAddress,
    '0.0.0.0',
  );
});

test('invalid bind addresses fail configuration instead of widening network access', () => {
  for (const value of ['', 'example.com', '::', '0.0.0.0;evil']) {
    assert.throws(() => createProviderConfig({ AETHERGRID_BIND_ADDRESS: value }));
  }
});
