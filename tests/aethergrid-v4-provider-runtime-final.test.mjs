import test from 'node:test';
import assert from 'node:assert/strict';

import { createProviderRegistry } from '../apps/aethergrid-console/providers/provider-registry.mjs';
import { createProviderHealth } from '../apps/aethergrid-console/providers/provider-health.mjs';

test('provider health counters: tracks request, success, failure, timeout, rateLimited, cache hits, and fallback counts', () => {
  const health = createProviderHealth();
  health.registerProvider('test-provider', {
    id: 'test-provider',
    name: 'Test Provider',
    capability: 'test',
  });

  health.recordExecution('test-provider', { success: true, latencyMs: 50, cacheHit: false });
  health.recordExecution('test-provider', { success: true, latencyMs: 10, cacheHit: true });
  health.recordExecution('test-provider', { error: true, timeout: true });
  health.recordExecution('test-provider', { error: true, rateLimited: true });

  const summary = health.getAllStatuses();
  const providerHealth = summary['test-provider'];

  assert.equal(providerHealth.requestCount, 4);
  assert.equal(providerHealth.successCount, 1);
  assert.equal(providerHealth.freshCacheHitCount, 1);
  assert.equal(providerHealth.failureCount, 1);
  assert.equal(providerHealth.timeoutCount, 1);
  assert.equal(providerHealth.rateLimitedCount, 1);
});

test('provider registry: canonical providers and futureProviders aliases match', () => {
  const registry = createProviderRegistry({
    env: {
      AETHERGRID_DWAVE_API_TOKEN: 'fake-dwave-token',
      AETHERGRID_DWAVE_SOLVER_URL: 'https://custom-dwave.example.com',
    },
  });

  assert.ok(registry.config.providers.dwave);
  assert.ok(registry.config.futureProviders.dwave);
  assert.equal(registry.config.providers.dwave.token, registry.config.futureProviders.dwave.token);
  assert.equal(
    registry.config.providers.dwave.solverUrl,
    registry.config.futureProviders.dwave.solverUrl,
  );
});
