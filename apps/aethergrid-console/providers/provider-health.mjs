export const PROVIDER_STATUS = Object.freeze({
  READY: 'ready',
  DEGRADED: 'degraded',
  UNCONFIGURED: 'unconfigured',
  UNAVAILABLE: 'unavailable',
  FALLBACK: 'fallback',
});

export function createProviderHealth() {
  const healthMap = new Map();

  function registerProvider(id, metadata = {}) {
    healthMap.set(id, {
      id,
      name: metadata.name || id,
      capabilities: Array.isArray(metadata.capabilities) ? [...metadata.capabilities] : [],
      status: metadata.status || PROVIDER_STATUS.UNCONFIGURED,
      hardwareEnabled: metadata.hardwareEnabled ?? false,
      details: metadata.details || '',
      lastCheck: Date.now(),
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

  function getProviderStatus(id) {
    return healthMap.get(id) || null;
  }

  function getAllStatuses() {
    const result = {};
    for (const [id, info] of healthMap.entries()) {
      result[id] = {
        name: info.name,
        capabilities: info.capabilities,
        status: info.status,
        ...(info.hardwareEnabled !== undefined ? { hardwareEnabled: info.hardwareEnabled } : {}),
      };
    }
    return result;
  }

  return {
    registerProvider,
    updateStatus,
    getProviderStatus,
    getAllStatuses,
  };
}
