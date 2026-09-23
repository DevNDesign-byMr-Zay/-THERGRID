import pino from 'pino';
import { z } from 'zod';

const LOG_LEVELS = Object.freeze(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

const RuntimeConfigSchema = z
  .object({
    port: z.coerce.number().int().min(1).max(65535).default(8080),
    logLevel: z.enum(LOG_LEVELS).default('info'),
  })
  .strict();

const LoggerOptionsSchema = z
  .object({
    level: z.enum(LOG_LEVELS).default('info'),
    service: z.string().trim().min(1).max(64).default('thergrid'),
    enabled: z.boolean().default(true),
  })
  .strict();

const RuntimeStatusSchema = z
  .object({
    service: z.literal('thergrid'),
    version: z.string().trim().min(1),
    status: z.enum(['ok', 'degraded']),
    uptimeSeconds: z.number().finite().nonnegative(),
    timestamp: z.string().datetime({ offset: true }),
    checks: z
      .object({
        runtime: z.enum(['available', 'degraded']),
      })
      .strict(),
  })
  .strict();

export function parseRuntimeConfig(environment = {}) {
  const parsed = RuntimeConfigSchema.parse({
    port: environment.THERGRID_PORT ?? 8080,
    logLevel: environment.THERGRID_LOG_LEVEL ?? 'info',
  });
  return Object.freeze(parsed);
}

export function createRuntimeLogger(options = {}) {
  const parsed = LoggerOptionsSchema.parse(options);
  return pino({
    level: parsed.level,
    enabled: parsed.enabled,
    base: { service: parsed.service },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export function buildRuntimeStatus({
  version = '0.1.0',
  status = 'ok',
  uptimeSeconds = process.uptime(),
  timestamp = new Date().toISOString(),
} = {}) {
  const parsed = RuntimeStatusSchema.parse({
    service: 'thergrid',
    version,
    status,
    uptimeSeconds,
    timestamp,
    checks: {
      runtime: status === 'ok' ? 'available' : 'degraded',
    },
  });

  return Object.freeze({
    ...parsed,
    checks: Object.freeze(parsed.checks),
  });
}

export function validateRuntimeStatus(value) {
  return RuntimeStatusSchema.safeParse(value).success;
}
