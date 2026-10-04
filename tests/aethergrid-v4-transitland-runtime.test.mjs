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

test('transitland: sends API key via apikey header and not in query string', async () => {
  let capturedUrl = '';

  const provider = createTransitlandProvider({
    apiKey: 'test-transitland-key-123',
    baseUrl: 'https://transit.land/api/v2/rest',
    fetchFn: async (url) => {
      capturedUrl = url;
      return {
        agencies: [
          {
            agency_id: 'MTA',
            agency_name: 'MTA Bus',
            city: 'New York',
            feeds: [
              {
                id: 'f-mta-bus',
                spec: 'gtfs-rt',
                urls: {
                  realtime_vehicle_positions:
                    'https://api-endpoint.mta.info/AccessSubway?key=secret',
                },
              },
            ],
          },
        ],
      };
    },
  });

  assert.equal(provider.configured(), true);
  const res = await provider.request({ city: 'New York' });

  assert.equal(capturedUrl.includes('apiKey='), false);
  assert.equal(capturedUrl.includes('apikey='), false);
  assert.equal(res.data.status, 'Transitland Catalog Discovered');
  assert.equal(res.data.feeds.length, 1);
  assert.equal(res.data.feeds[0].feedUrlValid, true);
  assert.equal(res.data.feeds[0].feedUrl, 'https://api-endpoint.mta.info/AccessSubway?key=secret');
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
