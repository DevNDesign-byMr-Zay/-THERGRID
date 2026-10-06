import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadTransitFeedConfig } from '../apps/aethergrid-console/providers/transit-feed-config.mjs';
import {
  createTransitRegistry,
  decodeGtfsRealtime,
} from '../apps/aethergrid-console/providers/transit-registry.mjs';

function withTempConfig(configObj, testFn) {
  const dir = mkdtempSync(join(tmpdir(), 'aethergrid-gtfs-test-'));
  const filePath = join(dir, 'gtfs-feeds.json');
  try {
    if (typeof configObj === 'string') {
      writeFileSync(filePath, configObj, 'utf8');
    } else if (configObj !== null) {
      writeFileSync(filePath, JSON.stringify(configObj, null, 2), 'utf8');
    }
    return testFn(filePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('loadTransitFeedConfig: empty/null file path yields unconfigured metadata', () => {
  const res = loadTransitFeedConfig('');
  assert.equal(res.metadata.source, 'unconfigured');
  assert.equal(res.metadata.configuredFeedCount, 0);
  assert.deepEqual(res.feeds, {});
});

test('loadTransitFeedConfig: missing file yields missing metadata with error', () => {
  const res = loadTransitFeedConfig('/tmp/non-existent-file-path-12345.json');
  assert.equal(res.metadata.source, 'missing');
  assert.equal(res.metadata.configuredFeedCount, 0);
  assert.equal(typeof res.metadata.error, 'string');
});

test('loadTransitFeedConfig: zero feeds in valid schema', () => {
  withTempConfig({ schemaVersion: 1, feeds: [] }, (filePath) => {
    const res = loadTransitFeedConfig(filePath);
    assert.equal(res.metadata.source, 'file');
    assert.equal(res.metadata.configuredFeedCount, 0);
    assert.equal(res.metadata.enabledFeedCount, 0);
  });
});

test('loadTransitFeedConfig: one feed with secret header reference', () => {
  const config = {
    schemaVersion: 1,
    feeds: [
      {
        id: 'mta-subway',
        cityId: 'nyc',
        agencyName: 'MTA Subway',
        url: 'https://api-endpoint.mta.info/AccessSubway',
        enabled: true,
        authHeaderEnv: 'MTA_API_KEY',
      },
    ],
  };

  withTempConfig(config, (filePath) => {
    const res = loadTransitFeedConfig(filePath, {
      env: { MTA_API_KEY: 'secret-key-999' },
    });
    assert.equal(res.metadata.configuredFeedCount, 1);
    assert.equal(res.metadata.enabledFeedCount, 1);
    assert.ok(res.feeds.nyc);
    assert.equal(res.feeds.nyc.feedUrl, 'https://api-endpoint.mta.info/AccessSubway');
    assert.equal(res.feeds.nyc.authHeader, 'secret-key-999');
  });
});

test('loadTransitFeedConfig: multiple cities and disabled feed', () => {
  const config = {
    schemaVersion: 1,
    feeds: [
      {
        id: 'sf-muni',
        cityId: 'sf',
        agencyName: 'SF Muni',
        url: 'https://api.sfmuni.org/gtfs.pb',
        enabled: true,
      },
      {
        id: 'cta-bus',
        cityId: 'chicago',
        agencyName: 'Chicago CTA',
        url: 'https://cta.example.com/gtfs.pb',
        enabled: true,
      },
      {
        id: 'disabled-feed',
        cityId: 'seattle',
        agencyName: 'Seattle Metro',
        url: 'https://seattle.example.com/gtfs.pb',
        enabled: false,
      },
    ],
  };

  withTempConfig(config, (filePath) => {
    const res = loadTransitFeedConfig(filePath);
    assert.equal(res.metadata.configuredFeedCount, 3);
    assert.equal(res.metadata.enabledFeedCount, 2);
    assert.ok(res.feeds.sf);
    assert.ok(res.feeds.chicago);
    assert.equal(res.feeds.seattle, undefined);
  });
});

test('loadTransitFeedConfig: duplicate active city binding throws error', () => {
  const config = {
    schemaVersion: 1,
    feeds: [
      {
        id: 'mta-bus',
        cityId: 'nyc',
        agencyName: 'MTA Bus',
        url: 'https://api.mta.info/bus.pb',
        enabled: true,
      },
      {
        id: 'mta-subway',
        cityId: 'nyc',
        agencyName: 'MTA Subway',
        url: 'https://api.mta.info/subway.pb',
        enabled: true,
      },
    ],
  };

  withTempConfig(config, (filePath) => {
    assert.throws(() => loadTransitFeedConfig(filePath), /Duplicate enabled GTFS-Realtime cityId/);
  });
});

test('loadTransitFeedConfig: malformed JSON or invalid schema throws validation error', () => {
  withTempConfig('{ invalid json }', (filePath) => {
    assert.throws(() => loadTransitFeedConfig(filePath));
  });

  withTempConfig({ schemaVersion: 1, feeds: [{ id: 'bad', url: 'not-a-url' }] }, (filePath) => {
    assert.throws(() => loadTransitFeedConfig(filePath));
  });
});

test('decodeGtfsRealtime: handles empty, valid, and malformed buffers gracefully', () => {
  assert.deepEqual(decodeGtfsRealtime(new Uint8Array(0)), {
    header: {},
    entities: [],
  });

  const resBad = decodeGtfsRealtime(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]));
  assert.ok(resBad !== undefined);
});

test('transitRegistry: requests city feed and reports unconfigured when city not bound', async () => {
  const registry = createTransitRegistry({
    feeds: {
      nyc: {
        id: 'mta-subway',
        cityId: 'nyc',
        agencyName: 'MTA Subway',
        feedUrl: 'https://api.mta.info/gtfs.pb',
      },
    },
    fetchFn: async () => new Uint8Array(0),
  });

  const resNyc = await registry.adapter.request({ cityId: 'nyc' });
  assert.equal(resNyc.data.cityId, 'nyc');
  assert.equal(resNyc.data.agencyName, 'MTA Subway');
  assert.equal(resNyc.receipt.live, true);

  const resUnknown = await registry.adapter.request({ cityId: 'unknown-city' });
  assert.equal(resUnknown.data.status, 'unconfigured');
  assert.equal(resUnknown.receipt.live, false);
});
