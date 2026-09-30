export function createProviderReceipt(options = {}) {
  const now = new Date().toISOString();

  return Object.freeze({
    provider: options.provider || 'unknown-provider',
    dataset: options.dataset || 'unknown-dataset',
    requestId: options.requestId || `req-${now}`,
    retrievedAt: options.retrievedAt || now,
    observedAt: options.observedAt || now,
    modelRunAt: options.modelRunAt || null,
    expiresAt: options.expiresAt || null,
    cacheState: options.cacheState || 'miss',
    live: options.live ?? true,
    stale: options.stale ?? false,
    fallback: options.fallback ?? false,
    attribution: options.attribution || '',
  });
}
