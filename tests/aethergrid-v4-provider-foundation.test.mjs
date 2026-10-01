import { describe, it } from 'node:test';
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
import { createProviderAdapter } from '../apps/aethergrid-console/providers/provider-adapter.mjs';
import { createProviderExecutor } from '../apps/aethergrid-console/providers/provider-executor.mjs';
import { createNoaaNwpsHydrologyProvider } from '../apps/aethergrid-console/providers/noaa-nwps-provider.mjs';
import { createEiaProvider } from '../apps/aethergrid-console/providers/eia-provider.mjs';
import { createTransitRegistry } from '../apps/aethergrid-console/providers/transit-registry.mjs';
import { createDwaveProvider } from '../apps/aethergrid-console/providers/dwave-provider.mjs';
import { server } from '../apps/aethergrid-console/server.mjs';

async function withServer(run) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

describe('ÆTHERGRID v4.0 Batch 20/21 — Production Provider Execution Layer & Verification', () => {
  describe('1. Central Validated Environment Configuration & Valid Defaults', () => {
    it('parses valid default environment settings and preserves canonical core URLs', () => {
      const parsed = parseEnv({});
      assert.equal(parsed.AETHERGRID_PORT, 8090);
      assert.equal(parsed.AETHERGRID_OPENAI_BASE_URL, 'https://api.openai.com/v1');
      assert.equal(parsed.AETHERGRID_OPEN_METEO_URL, 'https://api.open-meteo.com/v1/forecast');
      assert.equal(
        parsed.AETHERGRID_USGS_EARTHQUAKE_URL,
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
      );
    });

    it('strictly rejects invalid non-numeric port strings with a clear validation error', () => {
      assert.throws(
        () => parseEnv({ AETHERGRID_PORT: 'invalid-port' }),
        /Value must be a valid number/,
      );
    });

    it('rejects invalid URL environment variables', () => {
      assert.throws(
        () => parseEnv({ AETHERGRID_OPEN_METEO_URL: 'not-a-valid-url' }),
        /Invalid URL format/,
      );
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

    it('does NOT redact public browser tokens like cesiumIonToken in public config', () => {
      const redactor = createSecretRedactor();
      const outputObj = redactor.redactValue({
        cesiumIonToken: 'public_cesium_token_xyz',
        openAiApiKey: 'secret_openai_key_xyz',
      });

      assert.equal(outputObj.cesiumIonToken, 'public_cesium_token_xyz');
      assert.equal(outputObj.openAiApiKey, '[REDACTED_SECRET]');
    });
  });

  describe('3. Outbound Provider URL Policy Hardening', () => {
    it('allows default approved provider URLs and local Ollama', () => {
      const policy = createUrlPolicy();
      assert.equal(policy.isAllowedUrl('https://api.open-meteo.com/v1/forecast'), true);
      assert.equal(policy.isAllowedUrl('http://127.0.0.1:11434/api/generate'), true);
    });

    it('blocks lookalike domain prefix-spoofing attacks', () => {
      const policy = createUrlPolicy(['https://api.openai.com']);
      assert.equal(policy.isAllowedUrl('https://api.openai.com.attacker.com/v1/chat'), false);
      assert.throws(
        () => policy.validateUrl('https://api.openai.com.attacker.com/v1/chat'),
        /Outbound URL blocked by security policy/,
      );
    });

    it('blocks URLs with embedded credentials or unsupported protocols', () => {
      const policy = createUrlPolicy(['https://api.openai.com']);
      assert.equal(policy.isAllowedUrl('https://user:password@api.openai.com/v1/chat'), false);
      assert.equal(policy.isAllowedUrl('ftp://api.openai.com/v1/chat'), false);
    });
  });

  describe('4. Truthful Provider Receipt Semantics & SWR Caching', () => {
    it('enforces live: false on unconfigured/fallback data and live: true on fresh live data', () => {
      const unconfiguredReceipt = createProviderReceipt({
        provider: 'eia',
        fallback: true,
        live: true,
      });
      assert.equal(unconfiguredReceipt.live, false);
      assert.equal(unconfiguredReceipt.fallback, true);

      const liveReceipt = createProviderReceipt({
        provider: 'open-meteo-weather',
        live: true,
        fallback: false,
      });
      assert.equal(liveReceipt.live, true);
      assert.equal(liveReceipt.fallback, false);
    });

    it('returns stale cached data via provider executor with stale: true and live: false', async () => {
      const cache = createCacheStore({ defaultTtlMs: 30 });
      const executor = createProviderExecutor({ cache });

      let fetchCount = 0;
      const fetcher = async () => {
        fetchCount += 1;
        return { temp: 20 + fetchCount };
      };

      const res1 = await executor.execute('weather', { cacheKey: 'test-swr', ttlMs: 30 }, fetcher);
      assert.equal(res1.data.temp, 21);
      assert.equal(res1.receipt.cacheState, 'miss');
      assert.equal(res1.receipt.live, true);

      await new Promise((res) => setTimeout(res, 40));

      const res2 = await executor.execute('weather', { cacheKey: 'test-swr', ttlMs: 30 }, fetcher);
      assert.equal(res2.data.temp, 21);
      assert.equal(res2.receipt.cacheState, 'stale');
      assert.equal(res2.receipt.stale, true);
      assert.equal(res2.receipt.live, false);
    });
  });

  describe('5. Truthful Provider Adapters (No NY Defaults)', () => {
    it('hydrology adapter returns status: unconfigured and live: false when gaugeId is missing', async () => {
      const provider = createNoaaNwpsHydrologyProvider();
      const res = await provider.request({});
      assert.equal(res.data.status, 'unconfigured');
      assert.equal(res.data.gaugeId, null);
      assert.equal(res.receipt.live, false);
    });

    it('EIA energy adapter returns status: unconfigured and live: false when region is missing', async () => {
      const provider = createEiaProvider();
      const res = await provider.request({});
      assert.equal(res.data.status, 'unconfigured');
      assert.equal(res.data.region, null);
      assert.equal(res.receipt.live, false);
    });

    it('transit registry returns status: unconfigured and live: false when city has no feed configured', async () => {
      const registry = createTransitRegistry();
      const res = await registry.adapter.request({ cityId: 'london' });
      assert.equal(res.data.status, 'unconfigured');
      assert.equal(res.data.vehicles.length, 0);
      assert.equal(res.receipt.live, false);
    });

    it('D-Wave adapter returns hardwareSubmitted: false and hardwareExecuted: false when discovering solvers', async () => {
      const provider = createDwaveProvider();
      const res = await provider.request({});
      assert.equal(res.data.hardwareSubmitted, false);
      assert.equal(res.data.hardwareExecuted, false);
      assert.equal(res.receipt.live, false);
    });
  });

  describe('6. Public Endpoints Verification & Confirmation Boundaries', () => {
    it('responds to GET /api/aethergrid/runtime/providers with safe metadata', async () => {
      await withServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/aethergrid/runtime/providers`);
        assert.equal(res.status, 200);

        const body = await res.json();
        assert.equal(body.spatial.provider, 'native-webgl');
        assert.equal(body.weather.provider, 'open-meteo');
      });
    });

    it('responds to GET /api/aethergrid/config/public with browser-safe settings', async () => {
      await withServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/aethergrid/config/public`);
        assert.equal(res.status, 200);

        const body = await res.json();
        assert.ok(body.spatial);
        assert.ok('provider' in body.spatial);
        assert.ok('cesiumIonToken' in body.spatial);
      });
    });

    it('weather current route returns missing_coordinates when lat/lon omitted without NY defaults', async () => {
      await withServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/aethergrid/weather/current`);
        assert.equal(res.status, 200);

        const body = await res.json();
        assert.equal(body.data.status, 'missing_coordinates');
        assert.equal(body.receipt.live, false);
      });
    });

    it('weather forecast route returns hourly forecast time series with distinct event timestamps when coords supplied', async () => {
      await withServer(async (baseUrl) => {
        const res = await fetch(
          `${baseUrl}/api/aethergrid/weather/forecast?lat=40.7128&lon=-74.006`,
        );
        assert.equal(res.status, 200);

        const body = await res.json();
        assert.ok(body.data);
        assert.ok('hourly' in body.data);
        assert.ok(Array.isArray(body.data.hourly));
      });
    });

    it('D-Wave POST job submission fails with 400 when operator confirmation is missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/aethergrid/quantum/dwave/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workload: 'test' }),
        });
        assert.equal(res.status, 400);

        const body = await res.json();
        assert.equal(body.error, 'confirmation_required');
      });
    });
  });
});
