export const CIRCUIT_STATE = Object.freeze({
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
});

export function createCircuitBreaker(options = {}) {
  const name = options.name || 'unnamed-circuit-breaker';
  const failureThreshold = options.failureThreshold ?? 3;
  const resetTimeoutMs = options.resetTimeoutMs ?? 30000;

  let state = CIRCUIT_STATE.CLOSED;
  let failureCount = 0;
  let successCount = 0;
  let lastFailureTime = null;
  let lastError = null;

  function getState() {
    if (state === CIRCUIT_STATE.OPEN) {
      if (lastFailureTime && Date.now() - lastFailureTime >= resetTimeoutMs) {
        state = CIRCUIT_STATE.HALF_OPEN;
        successCount = 0;
      }
    }
    return state;
  }

  function recordSuccess() {
    if (state === CIRCUIT_STATE.HALF_OPEN) {
      state = CIRCUIT_STATE.CLOSED;
      failureCount = 0;
      lastFailureTime = null;
      lastError = null;
    } else if (state === CIRCUIT_STATE.CLOSED) {
      failureCount = 0;
    }
  }

  function recordFailure(error) {
    failureCount += 1;
    lastFailureTime = Date.now();
    lastError = error ? (error.message || String(error)) : 'Unknown provider error';

    if (state === CIRCUIT_STATE.HALF_OPEN || failureCount >= failureThreshold) {
      state = CIRCUIT_STATE.OPEN;
    }
  }

  async function execute(action, fallback) {
    const currentState = getState();

    if (currentState === CIRCUIT_STATE.OPEN) {
      if (typeof fallback === 'function') {
        const fallbackResult = await fallback({
          reason: 'circuit_open',
          lastError,
        });
        return {
          result: fallbackResult,
          usedFallback: true,
          circuitState: CIRCUIT_STATE.OPEN,
        };
      }
      throw new Error(`Circuit breaker '${name}' is OPEN. Request blocked.`);
    }

    try {
      const result = await action();
      recordSuccess();
      return {
        result,
        usedFallback: false,
        circuitState: getState(),
      };
    } catch (err) {
      recordFailure(err);
      if (typeof fallback === 'function') {
        const fallbackResult = await fallback({
          reason: 'provider_error',
          error: err,
        });
        return {
          result: fallbackResult,
          usedFallback: true,
          circuitState: getState(),
        };
      }
      throw err;
    }
  }

  function getStatus() {
    return {
      name,
      state: getState(),
      failureCount,
      lastFailureTime,
      lastError,
    };
  }

  return {
    execute,
    recordSuccess,
    recordFailure,
    getState,
    getStatus,
  };
}
