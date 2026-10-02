export function createProviderReceipt(options = {}) {
  const now = new Date().toISOString();

  const isExplicitFallback = Boolean(options.fallback) || Boolean(options.unconfigured);
  const live = Boolean(options.live) && !isExplicitFallback && !options.stale;
  const stale = Boolean(options.stale);
  const fallback = isExplicitFallback || (!live && !stale);

  return Object.freeze({
    provider: options.provider || 'unknown-provider',
    capability: options.capability || 'general',
    dataset: options.dataset || 'unknown-dataset',
    requestId: options.requestId || `req-${now}`,
    retrievedAt: options.retrievedAt || now,
    observedAt: options.observedAt || null,
    modelRunAt: options.modelRunAt || null,
    expiresAt: options.expiresAt || null,
    cacheState: options.cacheState || (live ? 'miss' : stale ? 'stale' : 'miss'),
    live,
    stale,
    fallback,
    attribution: options.attribution || '',
  });
}
