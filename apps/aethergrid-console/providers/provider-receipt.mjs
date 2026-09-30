export function createProviderReceipt(options = {}) {
  const now = new Date().toISOString();

  return Object.freeze({
    provider: options.provider || 'unknown-provider',
    capability: options.capability || 'general',
    dataset: options.dataset || 'unknown-dataset',
    requestId: options.requestId || `req-${Date.now()}`,
    retrievedAt: options.retrievedAt || now,
    observedAt: options.observedAt || null,
    modelRunAt: options.modelRunAt || null,
    expiresAt: options.expiresAt || null,
    cacheState: options.cacheState || 'miss',
    live: options.live ?? true,
    stale: options.stale ?? false,
    fallback: options.fallback ?? false,
    attribution: options.attribution || '',
  });
}
