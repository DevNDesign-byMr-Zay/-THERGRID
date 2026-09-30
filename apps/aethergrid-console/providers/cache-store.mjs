export function createCacheStore(options = {}) {
  const defaultTtlMs = options.defaultTtlMs ?? 60000;
  const store = new Map();

  function get(key) {
    const entry = store.get(key);
    if (!entry) {
      return { found: false, value: null, isStale: false, retrievedAt: null, metadata: { hit: false } };
    }

    const now = Date.now();
    const age = now - entry.retrievedAt;
    const isStale = age > entry.ttlMs;

    return {
      found: true,
      value: entry.value,
      isStale,
      retrievedAt: entry.retrievedAt,
      ttlMs: entry.ttlMs,
      metadata: {
        hit: true,
        isStale,
        ageMs: age,
      },
    };
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    const retrievedAt = Date.now();
    store.set(key, {
      value,
      retrievedAt,
      ttlMs,
    });
    return { key, retrievedAt, ttlMs };
  }

  function invalidate(key) {
    return store.delete(key);
  }

  function clear() {
    store.clear();
  }

  function size() {
    return store.size;
  }

  return {
    get,
    set,
    invalidate,
    clear,
    size,
  };
}
