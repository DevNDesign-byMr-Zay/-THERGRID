export function createRateLimiter(options = {}) {
  const name = options.name || 'unnamed-rate-limiter';
  const maxRequests = options.maxRequests ?? 60;
  const windowMs = options.windowMs ?? 60000;

  const timestamps = [];

  function cleanOld() {
    const cutoff = Date.now() - windowMs;
    while (timestamps.length > 0 && timestamps[0] <= cutoff) {
      timestamps.shift();
    }
  }

  function tryAcquire(tokens = 1) {
    cleanOld();
    if (timestamps.length + tokens > maxRequests) {
      return false;
    }
    const now = Date.now();
    for (let i = 0; i < tokens; i += 1) {
      timestamps.push(now);
    }
    return true;
  }

  function getStatus() {
    cleanOld();
    return {
      name,
      maxRequests,
      windowMs,
      currentUsage: timestamps.length,
      remaining: Math.max(0, maxRequests - timestamps.length),
    };
  }

  return {
    tryAcquire,
    getStatus,
  };
}
