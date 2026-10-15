import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderRegistry } from '../apps/aethergrid-console/providers/provider-registry.mjs';
import { createProviderReceipt } from '../apps/aethergrid-console/providers/provider-receipt.mjs';
import { createSecretRedactor } from '../apps/aethergrid-console/security/secret-redactor.mjs';

test('provider registry, health recording, and circuit breaker manage fault state', () => {
  const registry = createProviderRegistry({ env: process.env });
  assert.ok(registry.health);
  assert.ok(registry.getBreaker('test-provider'));

  const breaker = registry.getBreaker('test-provider');
  assert.equal(breaker.getState(), 'CLOSED');
  assert.equal(breaker.getStatus().state, 'CLOSED');
});

test('provider receipt generates valid provenance metadata', () => {
  const receipt = createProviderReceipt({
    provider: 'Tomorrow.io',
    capability: 'weather-current',
    dataset: 'weather-v4',
    live: true,
  });

  assert.equal(receipt.provider, 'Tomorrow.io');
  assert.equal(receipt.live, true);
  assert.equal(receipt.fallback, false);
  assert.ok(receipt.retrievedAt);
});

test('secret redactor prevents credential exposure', () => {
  const redactor = createSecretRedactor(['super-secret-api-key']);
  const obj = { apiKey: 'super-secret-api-key', nested: { secret: 'topsecret' } };
  const redacted = redactor.redactValue(obj);

  assert.equal(redacted.apiKey, '[REDACTED_SECRET]');
  assert.equal(redacted.nested.secret, '[REDACTED_SECRET]');
});
