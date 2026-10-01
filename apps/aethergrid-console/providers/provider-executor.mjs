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
  const defaultTimeoutMs = options.timeoutMs ?? (Number(process.env.AETHERGRID_PROVIDER_TIMEOUT_MS) || 10000);

  async function executeGovernedUpstreamCall(providerId, params = {}, fetcher) {
    const breaker = typeof getBreaker === 'function' ? getBreaker(providerId) : null;
    const limiter = typeof getRateLimiter === 'function' ? getRateLimiter(providerId) : null;
    const timeoutMs = params.timeoutMs ?? defaultTimeoutMs;

    // 1. Outbound URL Policy Validation FIRST
    if (params.url && urlPolicy) {
      urlPolicy.validateUrl(params.url);
    }

    // 2. Rate Limiting Check
    if (limiter && !limiter.tryAcquire()) {
      if (health) {
        health.recordExecution(providerId, {
          outcome: 'rateLimited',
          circuitState: breaker ? breaker.getState() : 'CLOSED',
          rateLimitRemaining: limiter.getStatus().remaining,
        });
      }
      throw new Error(`Rate limit exceeded for provider '${providerId}'`);
    }

    // 3. Circuit Breaker & AbortController Timeout Execution
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const action = async () => {
        if (typeof fetcher !== 'function') {
          throw new Error(`No fetcher supplied for provider '${providerId}'`);
        }
        return await fetcher({ signal: controller.signal });
      };

      let result;
      if (breaker) {
        const cbRes = await breaker.execute(action);
        result = cbRes.result;
      } else {
        result = await action();
      }

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (health) {
        health.recordExecution(providerId, {
          outcome: 'upstreamSuccess',
          latencyMs,
          circuitState: breaker ? breaker.getState() : 'CLOSED',
          rateLimitRemaining: limiter ? limiter.getStatus().remaining : null,
        });
      }

      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const isTimeout = controller.signal.aborted || err.name === 'AbortError' || err.message?.includes('aborted');
      const errMessage = isTimeout ? `Provider '${providerId}' timed out after ${timeoutMs}ms` : err.message || String(err);
      const outcome = isTimeout
        ? 'timeout'
        : breaker && breaker.getState() === 'OPEN'
          ? 'circuitOpen'
          : 'upstreamFailure';

      if (health) {
        health.recordExecution(providerId, {
          outcome,
          error: true,
          latencyMs,
          circuitState: breaker ? breaker.getState() : 'OPEN',
          rateLimitRemaining: limiter ? limiter.getStatus().remaining : null,
        });
      }

      const rawMsg = errMessage;
      const redactedMsg = redactor ? redactor.redactString(rawMsg) : rawMsg;
      throw new Error(`Provider Execution Error [${providerId}]: ${redactedMsg}`);
    }
  }

  async function execute(providerId, params = {}, fetcher, fallbackFetcher) {
    const capability = params.capability || 'general';
    const dataset = params.dataset || providerId;
    const requestId = params.requestId || `req-${Date.now()}`;
    const cacheKey = params.cacheKey || buildCanonicalCacheKey(providerId, capability, dataset, params);
    const ttlMs = params.ttlMs ?? options.defaultTtlMs ?? 60000;
    const attribution = params.attribution || '';
    const cachePolicy = params.cachePolicy || (ttlMs === 0 ? 'no-cache' : 'cache');
    const isCachingEnabled = Boolean(cache && cachePolicy !== 'no-cache' && cachePolicy !== 'none' && ttlMs > 0);

    // 1. URL Policy check before cache lookups or fallback
    if (params.url && urlPolicy) {
      urlPolicy.validateUrl(params.url);
    }

    // 2. Cache Lookup & SWR
    if (isCachingEnabled) {
      const cached = cache.get(cacheKey);
      if (cached.found) {
        if (!cached.isStale) {
          if (health) {
            health.recordExecution(providerId, {
              outcome: 'freshCacheHit',
              latencyMs: 0,
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
          // Stale cache hit -> return stale data immediately, trigger SWR background refresh via governed upstream primitive
          if (typeof fetcher === 'function') {
            Promise.resolve().then(async () => {
              try {
                const fresh = await executeGovernedUpstreamCall(providerId, params, fetcher);
                if (fresh?.live !== false && fresh?.status !== 'unconfigured') {
                  cache.set(cacheKey, fresh, ttlMs);
                }
              } catch {
                // Background refresh error handled silently by governed upstream call
              }
            });
          }

          if (health) {
            health.recordExecution(providerId, {
              outcome: 'staleCacheHit',
              latencyMs: 0,
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

    // 3. Cache miss or caching disabled -> Run Governed Upstream Call
    try {
      const result = await executeGovernedUpstreamCall(providerId, params, fetcher);
      if (isCachingEnabled && result?.live !== false && result?.status !== 'unconfigured') {
        cache.set(cacheKey, result, ttlMs);
      }
      const isLiveData = result?.live !== false && result?.status !== 'unconfigured' && !result?.fallback;
      const receipt = createProviderReceipt({
        provider: providerId,
        capability,
        dataset,
        requestId,
        cacheState: isCachingEnabled ? 'miss' : 'none',
        live: isLiveData,
        stale: false,
        fallback: !isLiveData,
        attribution,
      });

      return { data: result, receipt };
    } catch (err) {
      if (typeof fallbackFetcher === 'function') {
        const fallbackData = await fallbackFetcher({ reason: 'provider_error', error: err });
        if (health) {
          health.recordExecution(providerId, {
            outcome: 'fallback',
          });
        }
        const receipt = createProviderReceipt({
          provider: providerId,
          capability,
          dataset,
          requestId,
          cacheState: isCachingEnabled ? 'miss' : 'none',
          live: false,
          stale: false,
          fallback: true,
          attribution: attribution || `${providerId} (Fallback)`,
        });
        return { data: fallbackData, receipt };
      }
      throw err;
    }
  }

  return {
    execute,
    executeGovernedUpstreamCall,
  };
}
