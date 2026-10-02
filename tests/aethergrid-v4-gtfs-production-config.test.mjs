import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadTransitFeedConfig } from '../apps/aethergrid-console/providers/transit-feed-config.mjs';
import { createProviderConfig } from '../apps/aethergrid-console/config/provider-config.mjs';
import { createPublicConfig } from '../apps/aethergrid-console/config/public-config.mjs';

const cleanup = [];

afterEach(() => {
  while (cleanup.length) {
    rmSync(cleanup.pop(), { recursive: true, force: true });
  }
});

function writeRegistry(document) {
  const dir = mkdtempSync(join(tmpdir(), 'aethergrid-gtfs-'));
  cleanup.push(dir);
  const file = join(dir, 'feeds.json');
  writeFileSync(file, JSON.stringify(document), 'utf8');
  return { dir, file };
}

describe('ÆTHERGRID GTFS production feed configuration', () => {
  it('degrades safely when no registry path is configured', () => {
    const result = loadTransitFeedConfig('');

    assert.deepEqual(result.feeds, {});
    assert.equal(result.metadata.source, 'unconfigured');
    assert.equal(result.metadata.enabledFeedCount, 0);
  });

  it('degrades safely when a configured registry file is missing', () => {
    const result = loadTransitFeedConfig('/definitely/missing/aethergrid-gtfs.json');

    assert.deepEqual(result.feeds, {});
    assert.equal(result.metadata.source, 'missing');
    assert.equal(result.metadata.enabledFeedCount, 0);
    assert.equal(typeof result.metadata.error, 'string');
  });

  it('loads validated enabled feeds and resolves authorization only from env', () => {
    const { file } = writeRegistry({
      schemaVersion: 1,
      feeds: [
        {
          id: 'nyc-mta',
          cityId: 'new-york',
          agencyName: 'MTA',
          url: 'https://example.transit.test/gtfs.pb',
          enabled: true,
          authHeaderEnv: 'MTA_GTFS_AUTH',
        },
        {
          id: 'disabled-feed',
          cityId: 'disabled-city',
          agencyName: 'Disabled',
          url: 'https://disabled.example.test/feed.pb',
          enabled: false,
        },
      ],
    });

    const result = loadTransitFeedConfig(file, {
      env: { MTA_GTFS_AUTH: 'Bearer super-secret-test-token' },
    });

    assert.equal(result.metadata.configuredFeedCount, 2);
    assert.equal(result.metadata.enabledFeedCount, 1);
    assert.equal(result.metadata.cityCount, 1);
    assert.equal(result.feeds['new-york'].agencyName, 'MTA');
    assert.equal(result.feeds['new-york'].authHeader, 'Bearer super-secret-test-token');
    assert.equal(result.feeds['disabled-city'], undefined);
    assert.equal(JSON.stringify(result.metadata).includes('super-secret-test-token'), false);
  });

  it('rejects malformed or credential-bearing feed URLs', () => {
    const { file } = writeRegistry({
      schemaVersion: 1,
      feeds: [
        {
          id: 'bad-feed',
          cityId: 'bad-city',
          agencyName: 'Bad Feed',
          url: 'ftp://user:pass@example.test/feed.pb',
        },
      ],
    });

    assert.throws(() => loadTransitFeedConfig(file), /GTFS-Realtime feed URL|Invalid URL/i);
  });

  it('rejects duplicate enabled city bindings until multi-feed aggregation is implemented', () => {
    const { file } = writeRegistry({
      schemaVersion: 1,
      feeds: [
        {
          id: 'feed-a',
          cityId: 'new-york',
          agencyName: 'Agency A',
          url: 'https://a.example.test/feed.pb',
        },
        {
          id: 'feed-b',
          cityId: 'new-york',
          agencyName: 'Agency B',
          url: 'https://b.example.test/feed.pb',
        },
      ],
    });

    assert.throws(() => loadTransitFeedConfig(file), /Duplicate enabled GTFS-Realtime cityId/);
  });

  it('threads the registry path through private config and exposes only a safe configured flag publicly', () => {
    const privateConfig = createProviderConfig({
      AETHERGRID_GTFS_FEEDS_FILE: '/run/secrets/aethergrid/gtfs-feeds.json',
    });
    const publicConfig = createPublicConfig({
      AETHERGRID_GTFS_FEEDS_FILE: '/run/secrets/aethergrid/gtfs-feeds.json',
    });

    assert.equal(
      privateConfig.futureProviders.transit.feedsFile,
      '/run/secrets/aethergrid/gtfs-feeds.json',
    );
    assert.equal(publicConfig.futureProviders.transitConfigured, true);
    assert.equal(publicConfig.futureProviders.feedsFile, undefined);
  });
});
