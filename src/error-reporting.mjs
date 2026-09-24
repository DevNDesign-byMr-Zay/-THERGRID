function boundedText(value, name) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 128) {
    throw new TypeError(`${name} must be a non-empty string up to 128 characters`);
  }
  return text;
}

/** @param {Record<string, unknown>} [context] */
function safeContext(context = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new TypeError('error context must be a plain object');
  }

  return Object.freeze({
    scope: boundedText(context.scope ?? 'thergrid-runtime', 'scope'),
    ...(context.service ? { service: boundedText(context.service, 'service') } : {}),
    ...(Number.isInteger(context.port) ? { port: context.port } : {}),
  });
}

function reporterFailureMetadata(error) {
  return Object.freeze({
    event: 'error_reporter_failed',
    errorName: error instanceof Error ? error.name : 'Error',
  });
}

export function createErrorReporter({ onError = null, logger = null } = {}) {
  if (onError !== null && typeof onError !== 'function') {
    throw new TypeError('onError must be a function when provided');
  }

  return function reportError(error, context = {}) {
    if (!onError) return false;
    const captured = safeContext(context);

    try {
      const result = onError(error, captured);
      if (result && typeof result.then === 'function') {
        void Promise.resolve(result).catch((reporterError) => {
          logger?.warn?.(reporterFailureMetadata(reporterError), 'error reporter failed');
        });
      }
      return true;
    } catch (reporterError) {
      logger?.warn?.(reporterFailureMetadata(reporterError), 'error reporter failed');
      return false;
    }
  };
}
