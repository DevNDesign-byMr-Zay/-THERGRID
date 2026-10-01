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
      capabilities: Array.isArray(metadata.capabilities) ? [...metadata.capabilities] : [metadata.capability || 'general'],
      status: metadata.status || PROVIDER_STATUS.UNCONFIGURED,
      hardwareEnabled: metadata.hardwareEnabled ?? false,
      details: metadata.details || '',
      lastCheck: Date.now(),
      lastAttemptAt: null,
      lastLiveSuccessAt: null,
      lastFailureAt: null,
      lastFallbackAt: null,
      lastLatencyMs: null,
      cacheHit: false,
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
    let newStatus = existing.status;

    if (metrics.success) {
      if (metrics.fallbackActive) {
        newStatus = PROVIDER_STATUS.FALLBACK;
      } else {
        newStatus = PROVIDER_STATUS.READY;
      }
    } else if (metrics.circuitOpen) {
      newStatus = PROVIDER_STATUS.UNAVAILABLE;
    } else if (metrics.degraded) {
      newStatus = PROVIDER_STATUS.DEGRADED;
    } else if (metrics.error) {
      newStatus = PROVIDER_STATUS.UNAVAILABLE;
    }

    healthMap.set(id, {
      ...existing,
      status: newStatus,
      lastAttemptAt: now,
      lastLiveSuccessAt: metrics.success && !metrics.fallbackActive ? now : existing.lastLiveSuccessAt,
      lastFailureAt: metrics.error ? now : existing.lastFailureAt,
      lastFallbackAt: metrics.fallbackActive ? now : existing.lastFallbackAt,
      lastLatencyMs: metrics.latencyMs ?? existing.lastLatencyMs,
      cacheHit: metrics.cacheHit ?? existing.cacheHit,
      circuitState: metrics.circuitState || existing.circuitState,
      rateLimitRemaining: metrics.rateLimitRemaining ?? existing.rateLimitRemaining,
      fallbackActive: metrics.fallbackActive ?? existing.fallbackActive,
      lastCheck: now,
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
        ...(info.lastLiveSuccessAt ? { lastLiveSuccessAt: info.lastLiveSuccessAt } : {}),
        ...(info.lastFailureAt ? { lastFailureAt: info.lastFailureAt } : {}),
        ...(info.lastLatencyMs !== null && info.lastLatencyMs !== undefined
          ? { lastLatencyMs: info.lastLatencyMs }
          : {}),
        ...(info.cacheHit !== undefined ? { cacheHit: info.cacheHit } : {}),
        ...(info.circuitState ? { circuitState: info.circuitState } : {}),
        ...(info.fallbackActive !== undefined ? { fallbackActive: info.fallbackActive } : {}),
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
