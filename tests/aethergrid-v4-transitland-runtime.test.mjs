import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTransitlandProvider,
  validateDiscoveredFeedUrl,
} from '../apps/aethergrid-console/providers/transitland-provider.mjs';

test('transitland: unconfigured state when API key is missing', async () => {
  const provider = createTransitlandProvider({ apiKey: '' });
  assert.equal(provider.configured(), false);

  const res = await provider.request({ city: 'New York' });
  assert.equal(res.data.status, 'unconfigured');
  assert.equal(res.receipt.live, false);
});

test('transitland: discovers source feeds geographically without leaking the API key', async () => {
  let capturedUrl = '';

  const provider = createTransitlandProvider({
    apiKey: 'test-transitland-key-123',
    baseUrl: 'https://transit.land/api/v2/rest',
    fetchFn: async (url) => {
      capturedUrl = url;
      return {
        feeds: [
          {
            onestop_id: 'f-nycferry~rt',
            name: 'NYC Ferry realtime',
            spec: 'GTFS_RT',
            urls: {
              realtime_vehicle_positions: 'https://nycferry.example.test/vehicle-positions.pb',
              realtime_trip_updates: 'https://nycferry.example.test/trip-updates.pb',
            },
            associated_operators: [
              {
                onestop_id: 'o-dr5r-nycferry',
                name: 'NYC Ferry',
              },
            ],
          },
        ],
      };
    },
  });

  assert.equal(provider.configured(), true);
  const res = await provider.request({
    lat: 40.758,
    lon: -73.9855,
    radius: 15_000,
    limit: 20,
  });

  assert.match(capturedUrl, /\/feeds\?/u);
  assert.match(capturedUrl, /lat=40\.758/u);
  assert.match(capturedUrl, /lon=-73\.9855/u);
  assert.match(capturedUrl, /radius=10000/u);
  assert.equal(capturedUrl.includes('apiKey='), false);
  assert.equal(capturedUrl.includes('apikey='), false);
  assert.equal(res.data.status, 'Transitland Catalog Discovered');
  assert.equal(res.data.feedCount, 1);
  assert.equal(res.data.agencyCount, 1);
  assert.equal(res.data.feeds.length, 1);
  assert.equal(res.data.feeds[0].feedUrlValid, true);
  assert.equal(res.data.feeds[0].feedUrl, 'https://nycferry.example.test/vehicle-positions.pb');
  assert.equal(res.data.feeds[0].vehiclePositionsAvailable, true);
  assert.equal(res.data.feeds[0].tripUpdatesAvailable, true);
  assert.equal(res.receipt.dataset, 'feed-catalog');
});

test('transitland: text discovery still uses the feed catalog search contract', async () => {
  let capturedUrl = '';
  const provider = createTransitlandProvider({
    apiKey: 'test-transitland-key-123',
    baseUrl: 'https://transit.land/api/v2/rest',
    fetchFn: async (url) => {
      capturedUrl = url;
      return { feeds: [] };
    },
  });

  const res = await provider.request({ city: 'New York' });
  assert.match(capturedUrl, /\/feeds\?/u);
  assert.match(capturedUrl, /search=New\+York/u);
  assert.equal(res.data.feedCount, 0);
  assert.equal(res.receipt.dataset, 'feed-catalog');
});

test('validateDiscoveredFeedUrl: enforces HTTPS for remote feeds and allows HTTP for localhost', () => {
  assert.equal(validateDiscoveredFeedUrl('https://valid-remote.com/gtfs.pb').valid, true);
  assert.equal(validateDiscoveredFeedUrl('http://localhost:8080/gtfs.pb').valid, true);
  assert.equal(validateDiscoveredFeedUrl('http://127.0.0.1:8080/gtfs.pb').valid, true);

  const remoteHttp = validateDiscoveredFeedUrl('http://insecure-remote.com/gtfs.pb');
  assert.equal(remoteHttp.valid, false);
  assert.equal(remoteHttp.reason, 'remote_production_feeds_must_use_https');

  const invalidProto = validateDiscoveredFeedUrl('ftp://example.com/gtfs.pb');
  assert.equal(invalidProto.valid, false);
});

test('validateDiscoveredFeedUrl: rejects URLs with embedded credentials or secret query parameters', () => {
  const withKey = validateDiscoveredFeedUrl('https://example.com/feed.pb?key=secret123');
  assert.equal(withKey.valid, false);
  assert.equal(withKey.reason, 'credential_query_parameter_requires_server_side_auth');

  const withToken = validateDiscoveredFeedUrl('https://example.com/feed.pb?token=abc');
  assert.equal(withToken.valid, false);
  assert.equal(withToken.reason, 'credential_query_parameter_requires_server_side_auth');

  const withBasicAuth = validateDiscoveredFeedUrl('https://user:pass@example.com/feed.pb');
  assert.equal(withBasicAuth.valid, false);
  assert.equal(withBasicAuth.reason, 'url_embedded_basic_auth_not_permitted');
});
