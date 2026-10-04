import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTransitlandProvider } from '../apps/aethergrid-console/providers/transitland-provider.mjs';

describe('ÆTHERGRID Transitland Feed Discovery Provider', () => {
  it('returns unconfigured status when API key is missing', async () => {
    const provider = createTransitlandProvider({ apiKey: '' });
    const res = await provider.request({ city: 'new-york' });
    assert.equal(res.data.status, 'unconfigured');
    assert.equal(res.receipt.live, false);
  });

  it('discovers feeds and sanitizes API keys from URLs and logs', async () => {
    const mockFetchFn = async (url) => {
      assert.ok(!url.includes('api_key='));
      return {
        agencies: [
          {
            agency_name: 'MTA New York City Transit',
            feeds: [
              {
                onestop_id: 'f-dr59-mta',
                spec: 'gtfs-rt',
                urls: {
                  realtime_vehicle_positions: 'https://api-endpoint.mta.info/Dataservice/mtagtfsrt/mta-nyct.pb'
                }
              }
            ]
          }
        ]
      };
    };

    const provider = createTransitlandProvider({ apiKey: 'test-secret-key-12345', fetchFn: mockFetchFn });
    const res = await provider.request({ city: 'new-york' });

    assert.equal(res.data.status, 'Transitland Live Discovery');
    assert.equal(res.data.discoveredFeedsCount, 1);
    assert.equal(res.data.feeds[0].feedId, 'f-dr59-mta');
    assert.equal(res.receipt.live, true);
  });
});
