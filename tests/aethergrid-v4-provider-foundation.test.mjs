import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { parseEnv } from '../apps/aethergrid-console/config/env-schema.mjs';
import { createProviderConfig } from '../apps/aethergrid-console/config/provider-config.mjs';
import { createPublicConfig } from '../apps/aethergrid-console/config/public-config.mjs';
import { createSecretRedactor } from '../apps/aethergrid-console/security/secret-redactor.mjs';
import { createUrlPolicy } from '../apps/aethergrid-console/security/url-policy.mjs';
import { createCacheStore } from '../apps/aethergrid-console/providers/cache-store.mjs';
import {
  createCircuitBreaker,
  CIRCUIT_STATE,
} from '../apps/aethergrid-console/providers/circuit-breaker.mjs';
import { createRateLimiter } from '../apps/aethergrid-console/providers/rate-limiter.mjs';
import {
  createProviderHealth,
  PROVIDER_STATUS,
} from '../apps/aethergrid-console/providers/provider-health.mjs';
import { createProviderRegistry } from '../apps/aethergrid-console/providers/provider-registry.mjs';
import { createRequestContext } from '../apps/aethergrid-console/providers/request-context.mjs';
import { createProviderReceipt } from '../apps/aethergrid-console/providers/provider-receipt.mjs';
import { createProviderAdapter } from '../apps/aethergrid-console/providers/adapter.mjs';
import { server } from '../apps/aethergrid-console/server.mjs';

describe('ÆTHERGRID v4.0 — Provider, Configuration, Secret-Safety & Runtime Execution Foundation', () => {
  let activePort = 0;

  before(async () => {
    if (!server.listening) {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    }
    activePort = server.address().port;
  });

  after(async () => {
    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('1. Central Validated Environment Configuration', () => {
    it('parses valid default environment settings correctly', () => {
      const parsed = parseEnv({});
      assert.equal(parsed.AETHERGRID_PORT, 8090);
      assert.equal(parsed.AETHERGRID_AI_PROVIDER, 'local');
      assert.equal(parsed.AETHERGRID_QUANTUM_PROVIDER, 'local-simulator');
    });

    it('normalizes port numbers and invalid non-numeric port strings to defaults', () => {
      const parsed = parseEnv({ AETHERGRID_PORT: 'invalid-port' });
      assert.equal(parsed.AETHERGRID_PORT, 8090);
    });

    it('tolerates missing optional future provider configuration without throwing', () => {
      const config = createProviderConfig({});
      assert.equal(config.futureProviders.cesium.token, '');
      assert.equal(config.futureProviders.tomorrowIo.apiKey, '');
    });

    it('generates safe public configuration with boolean flags', () => {
      const publicCfg = createPublicConfig({
        AETHERGRID_IBM_QUANTUM_API_KEY: 'secret_key_123',
        AETHERGRID_IBM_QUANTUM_SERVICE_CRN: 'crn:v1:bluemix...',
      });
      assert.equal(publicCfg.quantum.hardwareEnabled, true);
      assert.equal(publicCfg.quantum.apiKey, undefined);
    });
  });

  describe('2. Secret Redaction Utility', () => {
    it('redacts known secrets from strings, objects, and errors', () => {
      const redactor = createSecretRedactor(['my_super_secret_api_key_xyz']);

      const redactedStr = redactor.redactString(
        'Error calling API with my_super_secret_api_key_xyz in URL',
      );
      assert.ok(!redactedStr.includes('my_super_secret_api_key_xyz'));
      assert.ok(redactedStr.includes('[REDACTED_SECRET]'));

      const redactedObj = redactor.redactValue({
        apiKey: 'my_super_secret_api_key_xyz',
        publicField: 'hello',
        nested: { token: 'secret_bearer_token' },
      });

      assert.equal(redactedObj.apiKey, '[REDACTED_SECRET]');
      assert.equal(redactedObj.publicField, 'hello');
      assert.equal(redactedObj.nested.token, '[REDACTED_SECRET]');
    });

    it('redacts Authorization bearer tokens and URL query parameter keys', () => {
      const redactor = createSecretRedactor();
      const output = redactor.redactString(
        'GET https://example.com/api?api_key=secret123 Authorization: Bearer abc.def.ghi',
      );
      assert.ok(!output.includes('secret123'));
      assert.ok(!output.includes('abc.def.ghi'));
      assert.ok(output.includes('[REDACTED_PARAM]'));
      assert.ok(output.includes('[REDACTED_TOKEN]'));
    });
  });

  describe('3. Outbound Provider URL Policy', () => {
    it('allows default approved provider URLs and local Ollama', () => {
      const policy = createUrlPolicy();
      assert.equal(policy.isAllowedUrl('https://api.open-meteo.com/v1/forecast'), true);
      assert.equal(policy.isAllowedUrl('http://127.0.0.1:11434/api/generate'), true);
    });

    it('blocks unapproved arbitrary client URLs', () => {
      const policy = createUrlPolicy();
      assert.equal(policy.isAllowedUrl('https://malicious-external-domain.com/steal'), false);
      assert.throws(
        () => policy.validateUrl('https://malicious-external-domain.com/steal'),
        /Outbound URL blocked by security policy/,
      );
    });
  });

  describe('4. Provider Cache Foundation', () => {
    it('supports set, get, TTL expiration and hit/miss metadata', async () => {
      const cache = createCacheStore({ defaultTtlMs: 50 });
      cache.set('key1', { temp: 22 });

      const hit = cache.get('key1');
      assert.equal(hit.found, true);
      assert.equal(hit.value.temp, 22);
      assert.equal(hit.isStale, false);
      assert.equal(hit.metadata.hit, true);

      await new Promise((res) => setTimeout(res, 60));

      const staleGet = cache.get('key1');
      assert.equal(staleGet.found, true);
      assert.equal(staleGet.isStale, true);
    });
  });

  describe('5. Provider Circuit Breaker', () => {
    it('transitions CLOSED -> OPEN -> HALF_OPEN on consecutive errors and timeout', async () => {
      const cb = createCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100 });

      assert.equal(cb.getState(), CIRCUIT_STATE.CLOSED);

      await cb.execute(
        () => Promise.reject(new Error('fail 1')),
        () => 'fallback 1',
      );
      assert.equal(cb.getState(), CIRCUIT_STATE.CLOSED);

      await cb.execute(
        () => Promise.reject(new Error('fail 2')),
        () => 'fallback 2',
      );
      assert.equal(cb.getState(), CIRCUIT_STATE.OPEN);

      const openCall = await cb.execute(
        () => Promise.resolve('ok'),
        () => 'circuit open fallback',
      );
      assert.equal(openCall.usedFallback, true);
      assert.equal(openCall.result, 'circuit open fallback');

      await new Promise((res) => setTimeout(res, 110));
      assert.equal(cb.getState(), CIRCUIT_STATE.HALF_OPEN);

      const successCall = await cb.execute(
        () => Promise.resolve('recovered'),
        () => 'fallback',
      );
      assert.equal(successCall.usedFallback, false);
      assert.equal(successCall.result, 'recovered');
      assert.equal(cb.getState(), CIRCUIT_STATE.CLOSED);
    });
  });

  describe('6. Provider Rate Limiter', () => {
    it('enforces request budgets per provider', () => {
      const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });
      assert.equal(limiter.tryAcquire(), true);
      assert.equal(limiter.tryAcquire(), true);
      assert.equal(limiter.tryAcquire(), false);

      const status = limiter.getStatus();
      assert.equal(status.currentUsage, 2);
      assert.equal(status.remaining, 0);
    });
  });

  describe('7. Provider Registry & Health', () => {
    it('registers capabilities and exposes normalized status', () => {
      const health = createProviderHealth();
      health.registerProvider('weather', {
        name: 'Open-Meteo',
        capabilities: ['weather'],
        status: PROVIDER_STATUS.READY,
      });

      const weatherStatus = health.getProviderStatus('weather');
      assert.equal(weatherStatus.status, 'ready');
      assert.deepEqual(weatherStatus.capabilities, ['weather']);
    });

    it('queryable by capability', () => {
      const registry = createProviderRegistry();
      const quantumProviders = registry.getProvidersByCapability('quantum');
      assert.ok('quantum' in quantumProviders);
      assert.equal(quantumProviders.quantum.status, 'ready');
    });
  });

  describe('8. Provider Endpoints Verification', () => {
    it('responds to GET /api/aethergrid/runtime/providers with safe metadata and no secrets', async () => {
      const res = await fetch(`http://127.0.0.1:${activePort}/api/aethergrid/runtime/providers`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.spatial.provider, 'native-webgl');
      assert.equal(body.spatial.status, 'ready');
      assert.equal(body.weather.provider, 'open-meteo');
      assert.equal(body.weather.status, 'ready');
      assert.equal(body.quantum.provider, 'local-simulator');
      assert.equal(body.quantum.hardwareEnabled, false);
      assert.equal(body.ai.status, 'ready');

      const textPayload = JSON.stringify(body);
      assert.ok(!textPayload.includes('apiKey'));
      assert.ok(!textPayload.includes('serviceCrn'));
      assert.ok(!textPayload.includes('token'));
    });

    it('responds to GET /api/aethergrid/config/public with browser-safe metadata and no secret keys', async () => {
      const res = await fetch(`http://127.0.0.1:${activePort}/api/aethergrid/config/public`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.ok(body.spatial);
      assert.ok('provider' in body.spatial);
      assert.ok('cesiumIonToken' in body.spatial);
      assert.ok('realityEnabled' in body.spatial);

      const textPayload = JSON.stringify(body);
      assert.ok(!textPayload.includes('AETHERGRID_IBM_QUANTUM_API_KEY'));
      assert.ok(!textPayload.includes('AETHERGRID_OPENAI_API_KEY'));
      assert.ok(!textPayload.includes('secret'));
    });

    it('responds to normalized provider API routes with safe metadata and provenance receipts', async () => {
      const endpoints = [
        '/api/aethergrid/weather/current',
        '/api/aethergrid/weather/forecast',
        '/api/aethergrid/hazards/alerts',
        '/api/aethergrid/hydrology/gauges',
        '/api/aethergrid/energy/context',
        '/api/aethergrid/transit/vehicles',
      ];

      for (const ep of endpoints) {
        const res = await fetch(`http://127.0.0.1:${activePort}${ep}`);
        assert.equal(res.status, 200, `Endpoint ${ep} should return 200`);
        const json = await res.json();
        assert.ok(json, `Endpoint ${ep} should return JSON`);
      }
    });

    it('creates normalized provider adapter and provenance receipts', () => {
      const context = createRequestContext({ userNode: 'test-node' });
      assert.ok(context.requestId.startsWith('req-'));
      assert.equal(context.userNode, 'test-node');

      const receipt = createProviderReceipt({
        provider: 'open-meteo',
        dataset: 'weather',
        cacheState: 'hit',
        live: true,
      });
      assert.equal(receipt.provider, 'open-meteo');
      assert.equal(receipt.cacheState, 'hit');
      assert.equal(receipt.live, true);

      const adapter = createProviderAdapter({
        id: 'test-adapter',
        capabilities: ['weather'],
        request: async () => ({ status: 'ok' }),
      });
      assert.equal(adapter.id, 'test-adapter');
      assert.deepEqual(adapter.capabilities, ['weather']);
    });
  });
});
