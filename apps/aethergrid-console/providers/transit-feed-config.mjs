import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const feedId = z.string().min(1).max(96).regex(/^[a-z0-9][a-z0-9._-]*$/i);
const httpUrl = z.string().url().refine((value) => {
  const parsed = new URL(value);
  return (
    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    !parsed.username &&
    !parsed.password
  );
}, 'GTFS-Realtime feed URL must use HTTP or HTTPS and must not embed credentials');

const feedSchema = z.object({
  id: feedId,
  cityId: feedId,
  agencyName: z.string().min(1).max(160),
  url: httpUrl,
  enabled: z.boolean().optional().default(true),
  authHeaderEnv: z.string().min(1).max(160).optional(),
});

const documentSchema = z.object({
  schemaVersion: z.literal(1),
  feeds: z.array(feedSchema).max(200),
});

export function loadTransitFeedConfig(filePath, options = {}) {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();

  if (!filePath || !String(filePath).trim()) {
    return {
      feeds: {},
      metadata: {
        source: 'unconfigured',
        configuredFeedCount: 0,
        enabledFeedCount: 0,
        cityCount: 0,
      },
    };
  }

  const absolutePath = resolve(cwd, String(filePath));
  let raw;

  try {
    raw = readFileSync(absolutePath, 'utf8');
  } catch (error) {
    return {
      feeds: {},
      metadata: {
        source: 'missing',
        configuredFeedCount: 0,
        enabledFeedCount: 0,
        cityCount: 0,
        error: error instanceof Error ? error.message : 'Unable to read GTFS feed configuration',
      },
    };
  }

  const parsed = documentSchema.parse(JSON.parse(raw));
  const feeds = {};
  let enabledFeedCount = 0;

  for (const definition of parsed.feeds) {
    if (!definition.enabled) continue;

    const cityKey = definition.cityId.toLowerCase();
    if (feeds[cityKey]) {
      throw new Error(
        `Duplicate enabled GTFS-Realtime cityId '${definition.cityId}'. Current runtime supports one production feed per city; use unique city IDs until multi-feed aggregation lands.`,
      );
    }

    const authHeader = definition.authHeaderEnv
      ? String(env[definition.authHeaderEnv] || '').trim()
      : '';

    feeds[cityKey] = Object.freeze({
      id: definition.id,
      cityId: definition.cityId,
      agencyName: definition.agencyName,
      feedUrl: definition.url,
      ...(authHeader ? { authHeader } : {}),
    });
    enabledFeedCount += 1;
  }

  return {
    feeds: Object.freeze(feeds),
    metadata: Object.freeze({
      source: 'file',
      schemaVersion: parsed.schemaVersion,
      configuredFeedCount: parsed.feeds.length,
      enabledFeedCount,
      cityCount: Object.keys(feeds).length,
    }),
  };
}
