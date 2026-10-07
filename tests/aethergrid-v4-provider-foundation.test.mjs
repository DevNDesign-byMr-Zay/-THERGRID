import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

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
import { validateCoordinates } from '../apps/aethergrid-console/providers/coordinate-validator.mjs';
import { createTomorrowWeatherProvider } from '../apps/aethergrid-console/providers/tomorrow-weather-provider.mjs';
import { createNoaaNwpsHydrologyProvider } from '../apps/aethergrid-console/providers/noaa-nwps-provider.mjs';
import { createEiaProvider } from '../apps/aethergrid-console/providers/eia-provider.mjs';
import { createNwsAlertsProvider } from '../apps/aethergrid-console/providers/nws-alerts-provider.mjs';
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

// Binary Protobuf Serializer Helper for GTFS-RT test fixtures
function encodeVarint(num) {
  const bytes = [];
  let n = num;
  while (n >= 0x80) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n & 0x7f);
  return bytes;
}

function encodeTag(fieldNumber, wireType) {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeStringField(fieldNumber, str) {
  const strBytes = new TextEncoder().encode(str);
  return [...encodeTag(fieldNumber, 2), ...encodeVarint(strBytes.length), ...strBytes];
}

function encodeVarintField(fieldNumber, num) {
  return [...encodeTag(fieldNumber, 0), ...encodeVarint(num)];
}

function encodeFloatField(fieldNumber, num) {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setFloat32(0, num, true);
  return [...encodeTag(fieldNumber, 5), ...buf];
}

function encodeSubMessageField(fieldNumber, subMsgBytes) {
  return [...encodeTag(fieldNumber, 2), ...encodeVarint(subMsgBytes.length), ...subMsgBytes];
}

function createGtfsVehiclePositionProtobuf({
  vehicleId,
  tripId,
  routeId,
  lat,
  lon,
  timestamp,
  currentStatus = 2,
  stopId = 'STOP-1',
}) {
  const tripBytes = [
    ...(tripId ? encodeStringField(1, tripId) : []),
    ...(routeId ? encodeStringField(5, routeId) : []),
  ];
  const posBytes = [
    ...(lat !== undefined ? encodeFloatField(1, lat) : []),
    ...(lon !== undefined ? encodeFloatField(2, lon) : []),
  ];
  const vDescBytes = [...(vehicleId ? encodeStringField(1, vehicleId) : [])];

  const vehicleMsgBytes = [
    ...(tripBytes.length ? encodeSubMessageField(1, tripBytes) : []),
    ...(posBytes.length ? encodeSubMessageField(2, posBytes) : []),
    ...encodeVarintField(4, currentStatus),
    ...encodeVarintField(5, timestamp || Math.floor(Date.now() / 1000)),
    ...encodeStringField(7, stopId),
    ...(vDescBytes.length ? encodeSubMessageField(8, vDescBytes) : []),
  ];

  const entityBytes = [
    ...encodeStringField(1, 'entity-1'),
    ...encodeSubMessageField(4, vehicleMsgBytes),
  ];

  const headerBytes = [
    ...encodeStringField(1, '2.0'),
    ...encodeVarintField(3, timestamp || Math.floor(Date.now() / 1000)),
  ];

  const feedMsgBytes = [
    ...encodeSubMessageField(1, headerBytes),
    ...encodeSubMessageField(2, entityBytes),
  ];

  return new Uint8Array(feedMsgBytes);
}

function createGtfsTripUpdateProtobuf({ tripId, routeId, delay }) {
  const tripBytes = [
    ...(tripId ? encodeStringField(1, tripId) : []),
    ...(routeId ? encodeStringField(5, routeId) : []),
  ];
  const stuBytes = [...encodeVarintField(1, 1), ...encodeStringField(4, 'STOP-10')];
  const tuBytes = [
    ...(tripBytes.length ? encodeSubMessageField(1, tripBytes) : []),
    ...encodeSubMessageField(2, stuBytes),
    ...(delay !== undefined ? encodeVarintField(5, delay) : []),
  ];

  const entityBytes = [
    ...encodeStringField(1, 'entity-tu-1'),
    ...encodeSubMessageField(3, tuBytes),
  ];

  const headerBytes = [
    ...encodeStringField(1, '2.0'),
    ...encodeVarintField(3, Math.floor(Date.now() / 1000)),
  ];

  return new Uint8Array([
    ...encodeSubMessageField(1, headerBytes),
    ...encodeSubMessageField(2, entityBytes),
  ]);
}

function createGtfsAlertProtobuf({ headerText, descriptionText, cause, effect }) {
  const hTextTransBytes = encodeStringField(1, headerText || 'Service Delay');
  const hTextBytes = encodeSubMessageField(1, hTextTransBytes);

  const dTextTransBytes = encodeStringField(1, descriptionText || 'Track maintenance');
  const dTextBytes = encodeSubMessageField(1, dTextTransBytes);

  const alertBytes = [
    ...encodeSubMessageField(6, hTextBytes),
    ...encodeSubMessageField(7, dTextBytes),
    ...(cause !== undefined ? encodeVarintField(3, cause) : []),
    ...(effect !== undefined ? encodeVarintField(4, effect) : []),
  ];

  const entityBytes = [
    ...encodeStringField(1, 'entity-alert-1'),
    ...encodeSubMessageField(5, alertBytes),
  ];

  const headerBytes = [
    ...encodeStringField(1, '2.0'),
    ...encodeVarintField(3, Math.floor(Date.now() / 1000)),
  ];

  return new Uint8Array([
    ...encodeSubMessageField(1, headerBytes),
    ...encodeSubMessageField(2, entityBytes),
  ]);
}

describe('ÆTHERGRID v4.0 Provider Runtime Execution Layer & Verification', () => {
  describe('1. Central Validated Environment Configuration & Valid Defaults', () => {
    it('parses valid default environment settings and preserves canonical core URLs', () => {
      const parsed = parseEnv({});
      assert.equal(parsed.AETHERGRID_PORT, 8090);
      assert.equal(parsed.AETHERGRID_OPENAI_BASE_URL, 'https://api.openai.com/v1');
      assert.equal(parsed.AETHERGRID_OPEN_METEO_URL, 'https://api.open-meteo.com/v1/forecast');
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

    it('generates safe public configuration with boolean flags', () => {
      const publicCfg = createPublicConfig({
        AETHERGRID_IBM_QUANTUM_API_KEY: 'secret_key_123',
        AETHERGRID_IBM_QUANTUM_SERVICE_CRN: 'crn:123',
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
    it('allows default approved provider URLs including D-Wave SAPI', () => {
      const policy = createUrlPolicy();
      assert.equal(policy.isAllowedUrl('https://api.open-meteo.com/v1/forecast'), true);
      assert.equal(policy.isAllowedUrl('https://sapi.qpu.dwavesys.com/v2/solvers/remote/'), true);
      assert.equal(policy.isAllowedUrl('http://127.0.0.1:11434/api/generate'), true);
      assert.equal(policy.isAllowedUrl('https://overpass.kumi.systems/api/interpreter'), true);
      assert.equal(policy.isAllowedUrl('https://overpass.nchc.org.tw/api/interpreter'), true);
      assert.equal(policy.isAllowedUrl('https://overpass.private.coffee/api/interpreter'), true);
      assert.equal(
        policy.isAllowedUrl('https://maps.mail.ru/osm/tools/overpass/api/interpreter'),
        true,
      );
      assert.equal(
        policy.isAllowedUrl('https://api.openstreetmap.org/api/0.6/map?bbox=0,0,1,1'),
        true,
      );
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

  describe('4. Truthful Provider Health Events & Cache Truth (Checkpoint 1)', () => {
    it('lastLiveSuccessAt changes ONLY after a genuine upstream success', () => {
      const health = createProviderHealth();
      health.registerProvider('test-provider', { status: PROVIDER_STATUS.CONFIGURED });

      assert.equal(health.getProviderStatus('test-provider').lastLiveSuccessAt, null);

      // Fresh cache hit MUST NOT update lastLiveSuccessAt
      health.recordExecution('test-provider', { outcome: 'freshCacheHit' });
      const afterFresh = health.getProviderStatus('test-provider');
      assert.equal(afterFresh.lastLiveSuccessAt, null);
      assert.ok(afterFresh.lastCacheHitAt);

      // Upstream success MUST update lastLiveSuccessAt and set READY
      health.recordExecution('test-provider', { outcome: 'upstreamSuccess', latencyMs: 50 });
      const afterUpstream = health.getProviderStatus('test-provider');
      assert.ok(afterUpstream.lastLiveSuccessAt);
      assert.equal(afterUpstream.status, PROVIDER_STATUS.READY);

      const savedSuccessTime = afterUpstream.lastLiveSuccessAt;

      // Stale cache hit MUST NOT update lastLiveSuccessAt and MUST set DEGRADED (never READY)
      health.recordExecution('test-provider', { outcome: 'staleCacheHit' });
      const afterStale = health.getProviderStatus('test-provider');
      assert.equal(afterStale.lastLiveSuccessAt, savedSuccessTime);
      assert.equal(afterStale.status, PROVIDER_STATUS.DEGRADED);

      // Fallback MUST NOT update lastLiveSuccessAt and MUST set FALLBACK
      health.recordExecution('test-provider', { outcome: 'fallback' });
      const afterFallback = health.getProviderStatus('test-provider');
      assert.equal(afterFallback.lastLiveSuccessAt, savedSuccessTime);
      assert.equal(afterFallback.status, PROVIDER_STATUS.FALLBACK);
    });

    it('ttlMs: 0 is respected and cachePolicy no-store bypasses caching', async () => {
      const cache = createCacheStore({ defaultTtlMs: 60000 });
      const executor = createProviderExecutor({ cache });

      let fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        return { count: fetchCount };
      };

      const res1 = await executor.execute(
        'test-svc',
        { cacheKey: 'no-store-key', ttlMs: 0, cachePolicy: 'no-store' },
        fetcher,
      );
      assert.equal(res1.data.count, 1);
      assert.equal(res1.receipt.cacheState, 'none');

      const res2 = await executor.execute(
        'test-svc',
        { cacheKey: 'no-store-key', ttlMs: 0, cachePolicy: 'no-store' },
        fetcher,
      );
      assert.equal(res2.data.count, 2);
      assert.equal(res2.receipt.cacheState, 'none');
    });
  });

  describe('5. Governed Upstream Execution & SWR Timeout Boundary (Checkpoint 1)', () => {
    it('single governed upstream execution primitive handles cache misses and SWR refresh', async () => {
      const cache = createCacheStore({ defaultTtlMs: 20 });
      const health = createProviderHealth();
      health.registerProvider('test-svc', { status: PROVIDER_STATUS.CONFIGURED });

      const executor = createProviderExecutor({ cache, health });

      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        return { value: `call-${callCount}`, live: true };
      };

      const res1 = await executor.execute('test-svc', { cacheKey: 'swr-key', ttlMs: 20 }, fetcher);
      assert.equal(res1.data.value, 'call-1');
      assert.equal(res1.receipt.cacheState, 'miss');

      await new Promise((r) => setTimeout(r, 30));

      const res2 = await executor.execute('test-svc', { cacheKey: 'swr-key', ttlMs: 20 }, fetcher);
      assert.equal(res2.data.value, 'call-1');
      assert.equal(res2.receipt.cacheState, 'stale');

      await new Promise((r) => setTimeout(r, 50));
      assert.equal(callCount, 2);
    });

    it('timeout enforces execution deadline using AbortController signal', async () => {
      const health = createProviderHealth();
      health.registerProvider('timeout-svc', { status: PROVIDER_STATUS.CONFIGURED });
      const executor = createProviderExecutor({ health });

      const slowFetcher = async ({ signal }) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Aborted'));
            });
          }
        });
        return { data: 'ok' };
      };

      await assert.rejects(
        () => executor.executeGovernedUpstreamCall('timeout-svc', { timeoutMs: 30 }, slowFetcher),
        /timed out after 30ms/,
      );

      const status = health.getProviderStatus('timeout-svc');
      assert.ok(status.lastFailureAt);
      assert.equal(status.status, PROVIDER_STATUS.UNAVAILABLE);
    });

    it('circuit breaker transitions from CLOSED to OPEN on repeated failures and HALF_OPEN on recovery', async () => {
      const cb = createCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 20 });

      assert.equal(cb.getState(), CIRCUIT_STATE.CLOSED);

      const failAction = async () => {
        throw new Error('upstream failure');
      };
      await assert.rejects(() => cb.execute(failAction), /upstream failure/);
      assert.equal(cb.getState(), CIRCUIT_STATE.CLOSED);

      await assert.rejects(() => cb.execute(failAction), /upstream failure/);
      assert.equal(cb.getState(), CIRCUIT_STATE.OPEN);

      // OPEN blocks calls
      await assert.rejects(() => cb.execute(failAction), /Circuit breaker/);

      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 30));
      assert.equal(cb.getState(), CIRCUIT_STATE.HALF_OPEN);

      // Recovery success closes breaker
      const successAction = async () => 'recovered';
      const res = await cb.execute(successAction);
      assert.equal(res.result, 'recovered');
      assert.equal(cb.getState(), CIRCUIT_STATE.CLOSED);
    });
  });

  describe('6. Shared Coordinate Validation (Checkpoint 3)', () => {
    it('validates lat/lon ranges and rejects NaN, Infinity, and out-of-bounds coordinates', () => {
      const valid = validateCoordinates('40.7128', '-74.006');
      assert.equal(valid.valid, true);
      assert.equal(valid.lat, 40.7128);
      assert.equal(valid.lon, -74.006);

      const outOfBoundsLat = validateCoordinates(95, -74.006);
      assert.equal(outOfBoundsLat.valid, false);
      assert.equal(outOfBoundsLat.code, 'invalid_coordinates');

      const nanCoord = validateCoordinates('abc', 'def');
      assert.equal(nanCoord.valid, false);
      assert.equal(nanCoord.code, 'invalid_coordinates');
    });
  });

  describe('7. Tomorrow.io Weather Provider Normalization (Checkpoint 3)', () => {
    it('normalizes realtime weather and forecast time series with distinct event timestamps', async () => {
      const mockFetchFn = async (url) => {
        if (url.includes('/weather/realtime')) {
          return {
            data: {
              time: '2026-10-01T12:00:00Z',
              values: {
                temperature: 22.5,
                temperatureApparent: 23.1,
                humidity: 55,
                precipitationProbability: 10,
                windSpeed: 4.2,
                windDirection: 180,
                weatherCode: 1000,
                pressureSurfaceLevel: 1013.2,
                visibility: 10,
              },
            },
          };
        }
        return {
          time: '2026-10-01T12:00:00Z',
          data: {
            timelines: {
              hourly: [
                {
                  time: '2026-10-01T12:00:00Z',
                  values: { temperature: 22.5, humidity: 55, weatherCode: 1000 },
                },
                {
                  time: '2026-10-01T13:00:00Z',
                  values: { temperature: 23.0, humidity: 52, weatherCode: 1000 },
                },
              ],
            },
          },
        };
      };

      const provider = createTomorrowWeatherProvider({ apiKey: 'test-key', fetchFn: mockFetchFn });

      const realtimeRes = await provider.request({ lat: 40.7128, lon: -74.006, mode: 'realtime' });
      assert.equal(realtimeRes.data.temperatureCelsius, 22.5);
      assert.equal(realtimeRes.data.observedAt, '2026-10-01T12:00:00Z');
      assert.equal(realtimeRes.receipt.live, true);

      const forecastRes = await provider.request({ lat: 40.7128, lon: -74.006, mode: 'forecast' });
      assert.equal(forecastRes.data.timesteps.length, 2);
      assert.equal(forecastRes.data.timesteps[0].time, '2026-10-01T12:00:00Z');
      assert.equal(forecastRes.receipt.live, true);
    });

    it('exercises globalThis.fetch fallback branch for Tomorrow.io when fetchFn omitted', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => ({
          ok: true,
          json: async () => ({
            data: { time: '2026-10-01T12:00:00Z', values: { temperature: 19.5, humidity: 60 } },
          }),
        });

        const provider = createTomorrowWeatherProvider({ apiKey: 'test-key' });
        const res = await provider.request({ lat: 40.7128, lon: -74.006, mode: 'realtime' });
        assert.equal(res.data.temperatureCelsius, 19.5);
        assert.equal(res.data.humidityPercent, 60);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('8. NOAA NWPS Hydrology Pipeline Fix (Checkpoint 3)', () => {
    it('runs metadata and stageflow through governed provider execution', async () => {
      const mockFetchFn = async (url) => {
        if (url.endsWith('/stageflow')) {
          return {
            observed: { primary: 12.4, secondary: 1500, validTime: '2026-10-01T12:00:00Z' },
            forecast: {
              primary: 13.1,
              validTime: '2026-10-01T18:00:00Z',
              data: [{ validTime: '2026-10-01T18:00:00Z', primary: 13.1, secondary: 1600 }],
            },
          };
        }
        return {
          name: 'Hudson River at Albany',
          latitude: 42.6526,
          longitude: -73.7562,
          flood: { action: 10, minor: 12, moderate: 15, major: 18 },
        };
      };

      const provider = createNoaaNwpsHydrologyProvider({ fetchFn: mockFetchFn });
      const res = await provider.request({ gaugeId: 'ALBN6' });

      assert.equal(res.data.gaugeId, 'ALBN6');
      assert.equal(res.data.observedStageFeet, 12.4);
      assert.equal(res.data.observedFlowCfs, 1500);
      assert.equal(res.receipt.live, true);
    });

    it('exercises globalThis.fetch fallback branch for NOAA NWPS when fetchFn omitted', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (url) => ({
          ok: true,
          json: async () => {
            if (url.includes('/stageflow')) {
              return { observed: { primary: 10.5, secondary: 1200 } };
            }
            return { name: 'Hudson River', latitude: 42.6, longitude: -73.7 };
          },
        });

        const provider = createNoaaNwpsHydrologyProvider();
        const res = await provider.request({ gaugeId: 'ALBN6' });
        assert.equal(res.data.observedStageFeet, 10.5);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('9. EIA Data Truth (Checkpoint 3)', () => {
    it('normalizes missing/invalid generation values to null (never zero) and validates region format', async () => {
      const mockFetchFn = async () => ({
        response: {
          data: [
            {
              period: '2026-10-01T12',
              respondent: 'CISO',
              fueltype: 'SOL',
              'type-name': 'Solar',
              value: 4500,
              units: 'megawatthours',
            },
            {
              period: '2026-10-01T12',
              respondent: 'CISO',
              fueltype: 'WND',
              'type-name': 'Wind',
              value: 'invalid-num',
              units: 'megawatthours',
            },
            {
              period: '2026-10-01T12',
              respondent: 'CISO',
              fueltype: 'NUC',
              'type-name': 'Nuclear',
              value: null,
              units: 'megawatthours',
            },
          ],
        },
      });

      const provider = createEiaProvider({ apiKey: 'eia-test-key', fetchFn: mockFetchFn });

      const res = await provider.request({ region: 'CISO' });
      assert.equal(res.data.fuelMix.length, 3);
      assert.equal(res.data.fuelMix[0].value, 4500);
      assert.equal(res.data.fuelMix[1].value, null); // MUST be null, not 0!
      assert.equal(res.data.fuelMix[2].value, null);
      assert.equal(res.data.fuelMix[0].sourceUnits, 'megawatthours');
      assert.equal(res.receipt.live, true);

      const invalidRegionRes = await provider.request({ region: 'bad region code !@#' });
      assert.equal(invalidRegionRes.data.status, 'invalid_region');
      assert.equal(invalidRegionRes.receipt.live, false);
    });

    it('exercises globalThis.fetch fallback branch for EIA when fetchFn omitted', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => ({
          ok: true,
          json: async () => ({
            response: {
              data: [{ period: '2026-10-01T12', respondent: 'PJM', fueltype: 'NG', value: 8000 }],
            },
          }),
        });

        const provider = createEiaProvider({ apiKey: 'eia-test-key' });
        const res = await provider.request({ region: 'PJM' });
        assert.equal(res.data.fuelMix[0].value, 8000);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('10. NWS Active Hazards Normalization (Checkpoint 3)', () => {
    it('preserves zero-alert results as valid live source responses and normalizes alert metadata', async () => {
      let mockFeatures = [];
      const mockFetchFn = async () => ({ features: mockFeatures });

      const provider = createNwsAlertsProvider({ fetchFn: mockFetchFn });

      // Zero-alert query
      const zeroAlertRes = await provider.request({ lat: 40.7128, lon: -74.006 });
      assert.equal(zeroAlertRes.data.count, 0);
      assert.equal(zeroAlertRes.data.alerts.length, 0);
      assert.equal(zeroAlertRes.receipt.live, true);

      // Populated alert query
      mockFeatures = [
        {
          id: 'NWS-ALERT-1',
          properties: {
            event: 'Flood Warning',
            headline: 'Flood Warning issued for Coastal Area',
            severity: 'Severe',
            urgency: 'Immediate',
            certainty: 'Observed',
            description: 'River levels rising rapidly',
            instruction: 'Move to higher ground',
            effective: '2026-10-01T10:00:00Z',
            expires: '2026-10-01T18:00:00Z',
            areaDesc: 'Coastal Zone A',
            affectedZones: ['https://api.weather.gov/zones/county/NYC001'],
          },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ];

      const popRes = await provider.request({ lat: 40.7128, lon: -74.006 });
      assert.equal(popRes.data.count, 1);
      assert.equal(popRes.data.alerts[0].id, 'NWS-ALERT-1');
      assert.equal(popRes.data.alerts[0].event, 'Flood Warning');
      assert.equal(popRes.data.alerts[0].severity, 'Severe');
      assert.equal(popRes.data.alerts[0].affectedArea, 'Coastal Zone A');
      assert.equal(popRes.receipt.live, true);
    });

    it('exercises globalThis.fetch fallback branch for NWS when fetchFn omitted', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => ({
          ok: true,
          json: async () => ({ features: [] }),
        });

        const provider = createNwsAlertsProvider();
        const res = await provider.request({ lat: 40.7128, lon: -74.006 });
        assert.equal(res.data.count, 0);
        assert.equal(res.receipt.live, true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('11. GTFS-Realtime Protobuf Decoding & Dynamic Feed Registry (Checkpoint 3)', () => {
    it('decodes GTFS-RT binary protobuf feeds (VehiclePosition, TripUpdate, Alert), rejects undecoded, and uses dynamic feed registry', async () => {
      const registry = createTransitRegistry();

      const unconfRes = await registry.adapter.request({ cityId: 'unknown-city' });
      assert.equal(unconfRes.data.status, 'unconfigured');
      assert.equal(unconfRes.receipt.live, false);

      // Test VehiclePosition protobuf decoding
      const vpBytes = createGtfsVehiclePositionProtobuf({
        vehicleId: 'TRAIN-101',
        tripId: 'TRIP-999',
        routeId: 'YAMANOTE',
        lat: 35.6762,
        lon: 139.6503,
      });

      registry.registerFeed('tokyo', {
        agencyName: 'JR East',
        feedUrl: 'https://api.jreast.co.jp/gtfsrt',
      });

      const mockFetchFn = async () => vpBytes;
      const customRegistry = createTransitRegistry({
        feeds: registry.getRegisteredFeeds(),
        fetchFn: mockFetchFn,
      });

      const decodedRes = await customRegistry.adapter.request({ cityId: 'tokyo' });
      assert.equal(decodedRes.data.status, 'GTFS-Realtime Live');
      assert.equal(decodedRes.data.vehicles.length, 1);
      assert.equal(decodedRes.data.vehicles[0].vehicleId, 'TRAIN-101');
      assert.equal(decodedRes.data.vehicles[0].routeId, 'YAMANOTE');
      assert.equal(Math.round(decodedRes.data.vehicles[0].latitude), 36);
      assert.equal(decodedRes.data.vehicles[0].currentStatus, 2);
      assert.equal(decodedRes.data.vehicles[0].stopId, 'STOP-1');
      assert.equal(typeof decodedRes.data.vehicles[0].timestamp, 'number');
      assert.equal(decodedRes.receipt.live, true);

      // Test TripUpdate protobuf decoding
      const tuBytes = createGtfsTripUpdateProtobuf({
        tripId: 'TRIP-777',
        routeId: 'EXPRESS',
        delay: 120,
      });
      const tuRegistry = createTransitRegistry({
        feeds: { tokyo: { agencyName: 'JR East', feedUrl: 'http://test' } },
        fetchFn: async () => tuBytes,
      });
      const tuRes = await tuRegistry.adapter.request({ cityId: 'tokyo' });
      assert.equal(tuRes.data.tripUpdates.length, 1);
      assert.equal(tuRes.data.tripUpdates[0].tripId, 'TRIP-777');
      assert.equal(tuRes.data.tripUpdates[0].delay, 120);
      assert.equal(tuRes.data.tripUpdates[0].stopTimeUpdate.length, 1);
      assert.equal(tuRes.data.tripUpdates[0].stopTimeUpdate[0].stopId, 'STOP-10');

      // Test Alert protobuf decoding
      const alertBytes = createGtfsAlertProtobuf({
        headerText: 'Track Closed',
        descriptionText: 'Maintenance',
        cause: 1,
        effect: 2,
      });
      const alertRegistry = createTransitRegistry({
        feeds: { tokyo: { agencyName: 'JR East', feedUrl: 'http://test' } },
        fetchFn: async () => alertBytes,
      });
      const alertRes = await alertRegistry.adapter.request({ cityId: 'tokyo' });
      assert.equal(alertRes.data.alerts.length, 1);
      assert.equal(alertRes.data.alerts[0].headerText, 'Track Closed');
      assert.equal(alertRes.data.alerts[0].descriptionText, 'Maintenance');
    });

    it('exercises globalThis.fetch fallback branch for GTFS when fetchFn omitted', async () => {
      const originalFetch = globalThis.fetch;
      try {
        const vpBytes = createGtfsVehiclePositionProtobuf({
          vehicleId: 'BUS-1',
          lat: 40.7,
          lon: -74.0,
        });
        globalThis.fetch = async () => ({
          ok: true,
          headers: new Map([['content-type', 'application/x-protobuf']]),
          arrayBuffer: async () => vpBytes.buffer,
        });

        const registry = createTransitRegistry({
          feeds: { nyc: { agencyName: 'MTA', feedUrl: 'https://api.mta.info/gtfs' } },
        });
        const res = await registry.adapter.request({ cityId: 'nyc' });
        assert.equal(res.data.vehicles.length, 1);
        assert.equal(res.data.vehicles[0].vehicleId, 'BUS-1');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('12. D-Wave SAPI v3 Quantum Provider & Lifecycle (Checkpoint 2)', () => {
    it('implements explicit action union [discover, submit, status, result] with answer endpoint and no-store caching', async () => {
      const mockFetchFn = async (url, opts = {}) => {
        if (url.endsWith('/solvers/remote/')) {
          return [
            {
              id: 'Advantage_system6.4',
              name: 'Advantage_system6.4',
              type: 'qpu',
              properties: { num_qubits: 5000 },
            },
          ];
        }
        if (url.endsWith('/problems/') && opts.method === 'POST') {
          return { id: 'dwave-prob-12345', status: 'SUBMITTED', solver: 'Advantage_system6.4' };
        }
        if (url.endsWith('/problems/dwave-prob-12345/')) {
          return {
            id: 'dwave-prob-12345',
            status: 'COMPLETED',
            solver: 'Advantage_system6.4',
          };
        }
        if (url.endsWith('/problems/dwave-prob-12345/answer/')) {
          return {
            answer: { solutions: [[1, 0, 1]], energies: [-1.5] },
          };
        }
        throw new Error(`Unhandled mock URL: ${url}`);
      };

      const provider = createDwaveProvider({ token: 'test-sapi-token', fetchFn: mockFetchFn });

      // Unknown action MUST fail with validation error
      await assert.rejects(
        () => provider.request({ action: 'unknown_action' }),
        /Unknown action 'unknown_action'/,
      );

      // 1. DISCOVER
      const discoverRes = await provider.request({ action: 'discover' });
      assert.equal(discoverRes.data.solvers.length, 1);
      assert.equal(discoverRes.data.solvers[0].id, 'Advantage_system6.4');
      assert.equal(discoverRes.data.hardwareSubmitted, false);
      assert.equal(discoverRes.data.hardwareExecuted, false);
      assert.equal(discoverRes.receipt.live, true);

      // 2. SUBMIT
      await assert.rejects(
        () => provider.request({ action: 'submit', confirmSubmission: false }),
        /Explicit operator confirmation/,
      );

      const submitRes = await provider.request({
        action: 'submit',
        confirmSubmission: true,
        solver: 'Advantage_system6.4',
        problemType: 'qubo',
        problemPayload: { Q: { '(0,0)': -1 } },
      });
      assert.equal(submitRes.data.problemId, 'dwave-prob-12345');
      assert.equal(submitRes.data.hardwareSubmitted, true);
      assert.equal(submitRes.data.hardwareExecuted, false);
      assert.equal(submitRes.receipt.live, true);

      // 3. STATUS
      const statusRes = await provider.request({ action: 'status', problemId: 'dwave-prob-12345' });
      assert.equal(statusRes.data.problemId, 'dwave-prob-12345');
      assert.equal(statusRes.data.status, 'COMPLETED');
      assert.equal(statusRes.data.hardwareSubmitted, true);
      assert.equal(statusRes.receipt.live, true);

      // 4. RESULT (answer endpoint /problems/{id}/answer/)
      const resultRes = await provider.request({ action: 'result', problemId: 'dwave-prob-12345' });
      assert.equal(resultRes.data.problemId, 'dwave-prob-12345');
      assert.equal(resultRes.data.hardwareExecuted, true);
      assert.ok(resultRes.data.result);
      assert.equal(resultRes.data.result.energies[0], -1.5);
    });

    it('exercises globalThis.fetch fallback branch for D-Wave when fetchFn omitted', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (url) => ({
          ok: true,
          json: async () => {
            if (url.includes('/solvers/remote/')) {
              return [{ id: 'QPU_1', name: 'QPU_1', type: 'qpu' }];
            }
            return { id: 'dwave-prob-888', status: 'SUBMITTED' };
          },
        });

        const provider = createDwaveProvider({ token: 'test-sapi-token' });
        const discRes = await provider.request({ action: 'discover' });
        assert.equal(discRes.data.solvers[0].id, 'QPU_1');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('13. Public Endpoints Integration & Request ID Propagation Proof (Checkpoint 4)', () => {
    it('responds to GET /api/aethergrid/runtime/providers with safe metadata', async () => {
      await withServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/aethergrid/runtime/providers`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.spatial.provider, 'native-webgl');
        assert.equal(body.weather.provider, 'open-meteo');
      });
    });

    it('propagates single requestId across request context -> adapter -> receipt', async () => {
      await withServer(async (baseUrl) => {
        const customReqId = 'req-trace-proof-999';
        const res = await fetch(`${baseUrl}/api/aethergrid/quantum/dwave/solvers`, {
          headers: { 'x-request-id': customReqId },
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.receipt.requestId, customReqId);
      });
    });

    it('rejects malformed coordinates with 400 Bad Request on weather routes', async () => {
      await withServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/aethergrid/weather/current?lat=95&lon=-74.006`);
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.error, 'invalid_coordinates');
      });
    });

    it('D-Wave POST job submission requires confirmation and valid payload', async () => {
      await withServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/aethergrid/quantum/dwave/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmSubmission: false }),
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.error, 'confirmation_required');
      });
    });
  });
});
