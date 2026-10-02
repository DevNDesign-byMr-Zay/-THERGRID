import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createProviderRegistry } from '../apps/aethergrid-console/providers/provider-registry.mjs';
import {
  createProviderHealth,
  PROVIDER_STATUS,
} from '../apps/aethergrid-console/providers/provider-health.mjs';
import { createTomorrowWeatherProvider } from '../apps/aethergrid-console/providers/tomorrow-weather-provider.mjs';

describe('ÆTHERGRID v4 provider fast closure', () => {
  it('does not let unconfigured IBM mask configured D-Wave hardware', () => {
    const registry = createProviderRegistry({
      env: {
        AETHERGRID_QUANTUM_PROVIDER: 'dwave',
        AETHERGRID_DWAVE_API_TOKEN: 'test-dwave-token',
      },
    });

    const runtime = registry.getSafePublicRuntimeMetadata();

    assert.equal(runtime.quantum.status, PROVIDER_STATUS.CONFIGURED);
    assert.equal(runtime.quantum.hardwareEnabled, true);
    assert.equal(runtime.quantum.providers.ibm.configured, false);
    assert.equal(runtime.quantum.providers.ibm.status, PROVIDER_STATUS.UNCONFIGURED);
    assert.equal(runtime.quantum.providers.dwave.configured, true);
    assert.equal(runtime.quantum.providers.dwave.status, PROVIDER_STATUS.CONFIGURED);
    assert.equal(runtime.quantum.providers.dwave.hardwareEnabled, true);
  });

  it('reports IBM and D-Wave independently when both hardware providers are configured', () => {
    const registry = createProviderRegistry({
      env: {
        AETHERGRID_QUANTUM_PROVIDER: 'ibm-quantum',
        AETHERGRID_IBM_QUANTUM_API_KEY: 'test-ibm-key',
        AETHERGRID_IBM_QUANTUM_SERVICE_CRN: 'crn:v1:test',
        AETHERGRID_DWAVE_API_TOKEN: 'test-dwave-token',
      },
    });

    const runtime = registry.getSafePublicRuntimeMetadata();

    assert.equal(runtime.quantum.hardwareEnabled, true);
    assert.equal(runtime.quantum.providers.ibm.configured, true);
    assert.equal(runtime.quantum.providers.dwave.configured, true);
    assert.equal(runtime.quantum.providers.local.hardwareEnabled, false);
    assert.equal(runtime.quantum.providers.ibm.apiKey, undefined);
    assert.equal(runtime.quantum.providers.dwave.token, undefined);
  });

  it('keeps local simulator truthful without claiming hardware', () => {
    const registry = createProviderRegistry({ env: {} });
    const runtime = registry.getSafePublicRuntimeMetadata();

    assert.equal(runtime.quantum.provider, 'local-simulator');
    assert.equal(runtime.quantum.status, PROVIDER_STATUS.READY);
    assert.equal(runtime.quantum.hardwareEnabled, false);
    assert.equal(runtime.quantum.providers.local.status, PROVIDER_STATUS.READY);
  });

  it('Tomorrow adapter advertises only executable weather capabilities', () => {
    const provider = createTomorrowWeatherProvider({ apiKey: 'test-key' });

    assert.deepEqual(provider.capabilities, ['weather', 'forecast']);
    assert.equal(provider.capabilities.includes('air-quality'), false);
  });

  it('tracks provider execution outcomes without rewriting live-success truth', () => {
    const health = createProviderHealth();
    health.registerProvider('example', {
      status: PROVIDER_STATUS.CONFIGURED,
      capability: 'weather',
    });

    health.recordExecution('example', { outcome: 'upstreamSuccess', latencyMs: 42 });
    health.recordExecution('example', { outcome: 'freshCacheHit' });
    health.recordExecution('example', { outcome: 'staleCacheHit' });
    health.recordExecution('example', { outcome: 'fallback' });
    health.recordExecution('example', { outcome: 'rateLimited' });
    health.recordExecution('example', { outcome: 'timeout', latencyMs: 2500 });
    health.recordExecution('example', { outcome: 'upstreamFailure' });

    const status = health.getAllStatuses().example;

    assert.equal(status.requestCount, 7);
    assert.equal(status.successCount, 1);
    assert.equal(status.failureCount, 2);
    assert.equal(status.timeoutCount, 1);
    assert.equal(status.rateLimitedCount, 1);
    assert.equal(status.freshCacheHitCount, 1);
    assert.equal(status.staleCacheHitCount, 1);
    assert.equal(status.fallbackCount, 1);
    assert.equal(status.lastLatencyMs, 2500);
    assert.ok(status.lastLiveSuccessAt);
    assert.ok(status.lastFailureAt);
  });
});
