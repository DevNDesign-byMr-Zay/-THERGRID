import http from 'node:http';
import { pathToFileURL } from 'node:url';
import pino from 'pino';
import { z } from 'zod';

const ENV_SCHEMA = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  SERVICE_NAME: z.string().trim().min(1).default('thergrid'),
});

export function parseHealthServiceConfig(environment = process.env) {
  return ENV_SCHEMA.parse(environment);
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

export function createPlatformHealthServer({
  serviceName = 'thergrid',
  logger = pino({ name: 'thergrid-health' }),
  startedAt = Date.now(),
} = {}) {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/status')) {
      const payload = {
        service: serviceName,
        status: 'ok',
        uptimeSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      };
      logger.info({ event: 'health_check', path: url.pathname, statusCode: 200 }, 'health check');
      json(res, 200, payload);
      return;
    }

    logger.warn({ event: 'health_not_found', path: url.pathname, statusCode: 404 }, 'route not found');
    json(res, 404, { service: serviceName, status: 'not_found' });
  });
}

export async function startPlatformHealthService(environment = process.env) {
  const config = parseHealthServiceConfig(environment);
  const logger = pino({ name: config.SERVICE_NAME });
  const server = createPlatformHealthServer({
    serviceName: config.SERVICE_NAME,
    logger,
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.PORT, '0.0.0.0', resolve);
  });

  logger.info(
    { event: 'health_service_started', port: config.PORT, service: config.SERVICE_NAME },
    'platform health service started',
  );

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startPlatformHealthService().catch((error) => {
    pino({ name: 'thergrid-health' }).error(
      { event: 'health_service_start_failed', error },
      'platform health service failed to start',
    );
    process.exitCode = 1;
  });
}
