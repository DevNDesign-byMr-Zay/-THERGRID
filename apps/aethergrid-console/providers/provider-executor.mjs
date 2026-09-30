import { createProviderReceipt } from './provider-receipt.mjs';

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
    const cacheKey = params.cacheKey || `${providerId}:${capability}:${JSON.stringify(params)}`;
    const ttlMs = params.ttlMs || 60000;
    const attribution = params.attribution || '';

    // 1. Rate Limiting Check
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
          cacheState: 'miss',
          live: false,
          fallback: true,
          attribution: attribution || `${providerId} (Rate Limited Fallback)`,
        });
        return { data: fallbackData, receipt };
      }
      throw new Error(`Rate limit exceeded for provider '${providerId}'`);
    }

    // 2. Cache Lookup & Stale-While-Revalidate (SWR) Check
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
          const receipt = createProviderReceipt({
            provider: providerId,
            capability,
            dataset,
            cacheState: 'hit',
            live: true,
            stale: false,
            fallback: false,
            attribution,
          });
          return { data: cached.value, receipt };
        } else {
          // Stale entry found! SWR behavior: Return stale cached data with stale: true and trigger background refresh if fetcher provided
          if (typeof fetcher === 'function') {
            Promise.resolve().then(async () => {
              try {
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

    // 3. Outbound URL Policy Validation
    if (params.url && urlPolicy) {
      urlPolicy.validateUrl(params.url);
    }

    // 4. Circuit Breaker Execution
    const startTime = Date.now();
    try {
      const action = async () => {
        if (typeof fetcher !== 'function') {
          throw new Error(`No fetcher supplied for provider '${providerId}'`);
        }
        const data = await fetcher();
        if (cache) {
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
          cacheState: 'miss',
          live: false,
          stale: false,
          fallback: true,
          attribution: attribution || `${providerId} (Fallback)`,
        });
        return { data, receipt };
      }

      if (health) {
        health.recordExecution(providerId, {
          success: true,
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
        cacheState: 'miss',
        live: true,
        stale: false,
        fallback: false,
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
