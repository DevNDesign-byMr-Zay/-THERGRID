import { createProviderReceipt } from './provider-receipt.mjs';

function buildCanonicalCacheKey(providerId, capability, dataset, params = {}) {
  const safeParams = {};
  for (const [k, v] of Object.entries(params)) {
    const lowerKey = k.toLowerCase();
    if (
      lowerKey.includes('key') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('auth') ||
      lowerKey === 'url'
    ) {
      continue;
    }
    safeParams[k] = v;
  }
  return `${providerId}:${capability}:${dataset}:${JSON.stringify(safeParams)}`;
}

export function createProviderExecutor(options = {}) {
  const urlPolicy = options.urlPolicy;
  const health = options.health;
  const redactor = options.redactor;
  const cache = options.cache;
  const getBreaker = options.getBreaker;
  const getRateLimiter = options.getRateLimiter;

  async function execute(providerId, params = {}, fetcher, fallbackFetcher) {
    const breaker = typeof getBreaker === 'function' ? getBreaker(providerId) : null;
    const limiter = typeof getRateLimiter === 'function' ? getRateLimiter(providerId) : null;

    const capability = params.capability || 'general';
    const dataset = params.dataset || providerId;
    const requestId = params.requestId || `req-${Date.now()}`;
    const cacheKey = params.cacheKey || buildCanonicalCacheKey(providerId, capability, dataset, params);
    const ttlMs = params.ttlMs || 60000;
    const attribution = params.attribution || '';

    // 1. Outbound URL Policy Validation FIRST (Security check before cache or fetch)
    if (params.url && urlPolicy) {
      urlPolicy.validateUrl(params.url);
    }

    // 2. Cache Lookup & SWR Check
    if (cache) {
      const cached = cache.get(cacheKey);
      if (cached.found) {
        if (!cached.isStale) {
          if (health) {
            health.recordExecution(providerId, {
              success: true,
              cacheHit: true,
              latencyMs: 0,
              circuitState: breaker ? breaker.getState() : 'CLOSED',
              rateLimitRemaining: limiter ? limiter.getStatus().remaining : null,
            });
          }
          const isLiveData = cached.value?.live !== false && cached.value?.status !== 'unconfigured';
          const receipt = createProviderReceipt({
            provider: providerId,
            capability,
            dataset,
            requestId,
            cacheState: 'hit',
            live: isLiveData,
            stale: false,
            fallback: !isLiveData,
            attribution,
          });
          return { data: cached.value, receipt };
        } else {
          // Stale entry found -> Return stale cached entry immediately with stale: true, live: false
          if (typeof fetcher === 'function') {
            Promise.resolve().then(async () => {
              try {
                if (params.url && urlPolicy) {
                  urlPolicy.validateUrl(params.url);
                }
                const fresh = await fetcher();
                cache.set(cacheKey, fresh, ttlMs);
              } catch {
                // Background refresh failure handled silently
              }
            });
          }

          if (health) {
            health.recordExecution(providerId, {
              success: true,
              cacheHit: true,
              degraded: true,
              latencyMs: 0,
              circuitState: breaker ? breaker.getState() : 'CLOSED',
              rateLimitRemaining: limiter ? limiter.getStatus().remaining : null,
            });
          }

          const receipt = createProviderReceipt({
            provider: providerId,
            capability,
            dataset,
            requestId,
            cacheState: 'stale',
            live: false,
            stale: true,
            fallback: false,
            attribution: attribution || `${providerId} (Stale Cached)`,
          });

          return { data: cached.value, receipt };
        }
      }
    }

    // 3. Rate Limiting Check
    if (limiter && !limiter.tryAcquire()) {
      if (health) {
        health.recordExecution(providerId, {
          error: true,
          degraded: true,
          circuitState: breaker ? breaker.getState() : 'CLOSED',
        });
      }

      if (typeof fallbackFetcher === 'function') {
        const fallbackData = await fallbackFetcher({ reason: 'rate_limited' });
        const receipt = createProviderReceipt({
          provider: providerId,
          capability,
          dataset,
          requestId,
          cacheState: 'miss',
          live: false,
          fallback: true,
          attribution: attribution || `${providerId} (Rate Limited Fallback)`,
        });
        return { data: fallbackData, receipt };
      }
      throw new Error(`Rate limit exceeded for provider '${providerId}'`);
    }

    // 4. Circuit Breaker Execution
    const startTime = Date.now();
    try {
      const action = async () => {
        if (typeof fetcher !== 'function') {
          throw new Error(`No fetcher supplied for provider '${providerId}'`);
        }
        const data = await fetcher();
        if (cache && data?.live !== false && data?.status !== 'unconfigured') {
          cache.set(cacheKey, data, ttlMs);
        }
        return data;
      };

      const fallbackAction = async (errInfo) => {
        if (typeof fallbackFetcher === 'function') {
          const fallbackData = await fallbackFetcher(errInfo);
          return { fallbackData, isFallback: true };
        }
        throw errInfo.error || new Error(`Provider '${providerId}' failed`);
      };

      let result;
      let usedFallback = false;

      if (breaker) {
        const cbRes = await breaker.execute(action, fallbackAction);
        usedFallback = cbRes.usedFallback;
        result = cbRes.result;
      } else {
        try {
          result = await action();
        } catch (err) {
          result = await fallbackAction({ reason: 'provider_error', error: err });
          usedFallback = true;
        }
      }

      const latencyMs = Date.now() - startTime;

      if (usedFallback) {
        const data = result?.fallbackData;
        if (health) {
          health.recordExecution(providerId, {
            success: true,
            fallbackActive: true,
            degraded: true,
            latencyMs,
            circuitState: breaker ? breaker.getState() : 'CLOSED',
            rateLimitRemaining: limiter ? limiter.getStatus().remaining : null,
          });
        }
        const receipt = createProviderReceipt({
          provider: providerId,
          capability,
          dataset,
          requestId,
          cacheState: 'miss',
          live: false,
          stale: false,
          fallback: true,
          attribution: attribution || `${providerId} (Fallback)`,
        });
        return { data, receipt };
      }

      const isLiveData = result?.live !== false && result?.status !== 'unconfigured' && !result?.fallback;

      if (health) {
        health.recordExecution(providerId, {
          success: true,
          fallbackActive: !isLiveData,
          cacheHit: false,
          latencyMs,
          circuitState: breaker ? breaker.getState() : 'CLOSED',
          rateLimitRemaining: limiter ? limiter.getStatus().remaining : null,
        });
      }

      const receipt = createProviderReceipt({
        provider: providerId,
        capability,
        dataset,
        requestId,
        cacheState: 'miss',
        live: isLiveData,
        stale: false,
        fallback: !isLiveData,
        attribution,
      });

      return { data: result, receipt };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      if (health) {
        health.recordExecution(providerId, {
          error: true,
          latencyMs,
          circuitState: breaker ? breaker.getState() : 'OPEN',
        });
      }
      const rawMsg = err.message || String(err);
      const redactedMsg = redactor ? redactor.redactString(rawMsg) : rawMsg;
      throw new Error(`Provider Execution Error [${providerId}]: ${redactedMsg}`);
    }
  }

  return {
    execute,
  };
}
