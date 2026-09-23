import { createServer } from 'node:http';

import { buildRuntimeStatus, createRuntimeLogger } from './runtime-observability.mjs';

function json(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  response.end(body);
}

export function createRuntimeRequestHandler({
  logger = createRuntimeLogger(),
  version = '0.1.0',
  now = () => new Date(),
  uptime = () => process.uptime(),
} = {}) {
  return (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (request.method !== 'GET') {
      json(
        response,
        405,
        {
          error: 'method_not_allowed',
        },
        {
          allow: 'GET',
        },
      );
      return;
    }

    if (url.pathname === '/health') {
      const status = buildRuntimeStatus({
        version,
        status: 'ok',
        uptimeSeconds: uptime(),
        timestamp: now().toISOString(),
      });
      logger.info(
        {
          event: 'runtime.health',
          status: status.status,
        },
        'runtime health checked',
      );
      json(response, 200, {
        service: status.service,
        status: status.status,
      });
      return;
    }

    if (url.pathname === '/status') {
      const status = buildRuntimeStatus({
        version,
        status: 'ok',
        uptimeSeconds: uptime(),
        timestamp: now().toISOString(),
      });
      logger.info(
        {
          event: 'runtime.status',
          status: status.status,
        },
        'runtime status checked',
      );
      json(response, 200, status);
      return;
    }

    json(response, 404, {
      error: 'not_found',
    });
  };
}

export function createRuntimeServer(options = {}) {
  return createServer(createRuntimeRequestHandler(options));
}

export async function startRuntimeService({
  host = '0.0.0.0',
  port = 8080,
  logger = createRuntimeLogger(),
  ...handlerOptions
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new TypeError('port must be an integer between 0 and 65535');
  }
  if (typeof host !== 'string' || !host.trim()) {
    throw new TypeError('host must be a non-empty string');
  }

  const server = createRuntimeServer({
    ...handlerOptions,
    logger,
  });

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });

  const address = server.address();
  logger.info(
    {
      event: 'runtime.started',
      host,
      port: typeof address === 'object' && address ? address.port : port,
    },
    'runtime service started',
  );

  return server;
}
