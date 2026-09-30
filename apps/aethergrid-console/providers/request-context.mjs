import { randomUUID } from 'node:crypto';

export function createRequestContext(overrides = {}) {
  const requestId = overrides.requestId || `req-${randomUUID().slice(0, 8)}`;
  const timestamp = overrides.timestamp || new Date().toISOString();

  return Object.freeze({
    requestId,
    timestamp,
    clientIp: overrides.clientIp || '127.0.0.1',
    userNode: overrides.userNode || 'operator-console',
    metadata: Object.freeze({ ...overrides.metadata }),
  });
}
