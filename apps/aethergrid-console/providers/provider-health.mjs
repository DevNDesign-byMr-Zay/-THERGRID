export const PROVIDER_STATUS = Object.freeze({
  UNCONFIGURED: 'unconfigured',
  CONFIGURED: 'configured',
  READY: 'ready',
  DEGRADED: 'degraded',
  UNAVAILABLE: 'unavailable',
  FALLBACK: 'fallback',
});

export function createProviderHealth() {
  const healthMap = new Map();

  function registerProvider(id, metadata = {}) {
    healthMap.set(id, {
      id,
      name: metadata.name || id,
      capability: metadata.capability || 'general',
      capabilities: Array.isArray(metadata.capabilities)
        ? [...metadata.capabilities]
        : [metadata.capability || 'general'],
      status: metadata.status || PROVIDER_STATUS.UNCONFIGURED,
      hardwareEnabled: metadata.hardwareEnabled ?? false,
      details: metadata.details || '',
      lastCheck: Date.now(),
      lastAttemptAt: null,
      lastLiveSuccessAt: null,
      lastFailureAt: null,
      lastFallbackAt: null,
      lastCacheHitAt: null,
      lastLatencyMs: null,
      cacheHit: false,
      cacheState: 'none',
      circuitState: 'CLOSED',
      rateLimitRemaining: null,
      fallbackActive: metadata.status === PROVIDER_STATUS.FALLBACK,
    });
  }

  function updateStatus(id, status, details = {}) {
    const existing = healthMap.get(id);
    if (!existing) return;

    healthMap.set(id, {
      ...existing,
      status,
      details: details.message || existing.details,
      hardwareEnabled: details.hardwareEnabled ?? existing.hardwareEnabled,
      lastCheck: Date.now(),
    });
  }

  function recordExecution(id, metrics = {}) {
    const existing = healthMap.get(id);
    if (!existing) return;

    const now = Date.now();
    let outcome = metrics.outcome;

    if (!outcome) {
      if (metrics.circuitOpen) {
        outcome = 'circuitOpen';
      } else if (metrics.timeout) {
        outcome = 'timeout';
      } else if (metrics.rateLimited) {
        outcome = 'rateLimited';
      } else if (metrics.error) {
        outcome = 'upstreamFailure';
      } else if (metrics.fallbackActive) {
        outcome = 'fallback';
      } else if (metrics.cacheHit) {
        outcome = metrics.degraded || metrics.stale ? 'staleCacheHit' : 'freshCacheHit';
      } else if (metrics.success) {
        outcome = 'upstreamSuccess';
      } else {
        outcome = 'upstreamFailure';
      }
    }

    let newStatus = existing.status;
    let newLiveSuccessAt = existing.lastLiveSuccessAt;
    let newFailureAt = existing.lastFailureAt;
    let newFallbackAt = existing.lastFallbackAt;
    let newCacheHitAt = existing.lastCacheHitAt;

    switch (outcome) {
      case 'upstreamSuccess':
        newStatus = PROVIDER_STATUS.READY;
        newLiveSuccessAt = now;
        break;
      case 'freshCacheHit':
        newCacheHitAt = now;
        break;
      case 'staleCacheHit':
        newCacheHitAt = now;
        newStatus = PROVIDER_STATUS.DEGRADED;
        break;
      case 'fallback':
        newFallbackAt = now;
        newStatus = PROVIDER_STATUS.FALLBACK;
        break;
      case 'rateLimited':
        newFailureAt = now;
        newStatus = PROVIDER_STATUS.DEGRADED;
        break;
      case 'timeout':
      case 'circuitOpen':
      case 'upstreamFailure':
      default:
        newFailureAt = now;
        newStatus = PROVIDER_STATUS.UNAVAILABLE;
        break;
    }

    healthMap.set(id, {
      ...existing,
      status: newStatus,
      lastCheck: now,
      lastAttemptAt: outcome === 'freshCacheHit' ? (existing.lastAttemptAt || now) : now,
      lastLiveSuccessAt: newLiveSuccessAt,
      lastFailureAt: newFailureAt,
      lastFallbackAt: newFallbackAt,
      lastCacheHitAt: newCacheHitAt,
      lastLatencyMs: metrics.latencyMs ?? existing.lastLatencyMs,
      cacheHit: outcome === 'freshCacheHit' || outcome === 'staleCacheHit',
      cacheState: outcome === 'freshCacheHit' ? 'hit' : outcome === 'staleCacheHit' ? 'stale' : 'miss',
      circuitState: metrics.circuitState || existing.circuitState,
      rateLimitRemaining: metrics.rateLimitRemaining ?? existing.rateLimitRemaining,
      fallbackActive: outcome === 'fallback',
    });
  }

  function getProviderStatus(id) {
    return healthMap.get(id) || null;
  }

  function getAllStatuses() {
    const result = {};
    for (const [id, info] of healthMap.entries()) {
      result[id] = {
        name: info.name,
        capability: info.capability,
        capabilities: info.capabilities,
        status: info.status,
        ...(info.hardwareEnabled !== undefined ? { hardwareEnabled: info.hardwareEnabled } : {}),
        ...(info.lastAttemptAt ? { lastAttemptAt: info.lastAttemptAt } : {}),
        ...(info.lastLiveSuccessAt ? { lastLiveSuccessAt: info.lastLiveSuccessAt } : {}),
        ...(info.lastFailureAt ? { lastFailureAt: info.lastFailureAt } : {}),
        ...(info.lastFallbackAt ? { lastFallbackAt: info.lastFallbackAt } : {}),
        ...(info.lastCacheHitAt ? { lastCacheHitAt: info.lastCacheHitAt } : {}),
        ...(info.lastLatencyMs !== null && info.lastLatencyMs !== undefined
          ? { lastLatencyMs: info.lastLatencyMs }
          : {}),
        ...(info.cacheHit !== undefined ? { cacheHit: info.cacheHit } : {}),
        ...(info.cacheState ? { cacheState: info.cacheState } : {}),
        ...(info.circuitState ? { circuitState: info.circuitState } : {}),
        ...(info.fallbackActive !== undefined ? { fallbackActive: info.fallbackActive } : {}),
        ...(info.rateLimitRemaining !== null && info.rateLimitRemaining !== undefined
          ? { rateLimitRemaining: info.rateLimitRemaining }
          : {}),
      };
    }
    return result;
  }

  return {
    registerProvider,
    updateStatus,
    recordExecution,
    getProviderStatus,
    getAllStatuses,
  };
}
