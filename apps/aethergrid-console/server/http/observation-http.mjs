import { validateCoordinates } from '../../providers/coordinate-validator.mjs';

export function createObservationHttp({ observationStore, providerRegistry }) {
  function send(response, status, body, type = 'application/json; charset=utf-8') {
    response.writeHead(status, {
      'content-type': type,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    response.end(body);
    return true;
  }

  async function json(response, status, payload) {
    if (status === 200 && response.observation) {
      const data = payload.data || payload;
      const live =
        payload.receipt?.live === true ||
        data.source?.live === true ||
        data.airQuality?.source?.live === true;
      if (live) {
        try {
          const saved = await observationStore.record({
            ...response.observation,
            payload: providerRegistry.redactor.redactValue(payload),
          });
          response.setHeader('x-aethergrid-observation', saved.receipt);
        } catch {
          return send(response, 503, JSON.stringify({ error: 'observation_storage_unavailable' }));
        }
      }
    }
    return send(response, status, JSON.stringify(payload, null, 2));
  }
  return { json, handleObservations };

  async function handleObservations({ request, response, url }) {
    if (request.method === 'GET' && url.pathname === '/api/aethergrid/history') {
      const query = {
        kind: url.searchParams.get('kind') || undefined,
        lat: url.searchParams.has('lat') ? Number(url.searchParams.get('lat')) : undefined,
        lon: url.searchParams.has('lon') ? Number(url.searchParams.get('lon')) : undefined,
        at: url.searchParams.get('at') || undefined,
      };
      const observations = await observationStore.list(query);
      return json(response, 200, {
        version: 1,
        observations,
        source: 'recorded-provider-observations',
        interpolated: false,
      });
    }
    const observationKinds = {
      '/api/aethergrid/weather/current': 'weather',
      '/api/aethergrid/environment': 'environment',
      '/api/aethergrid/city-live': 'city-live',
    };
    const kind = observationKinds[url.pathname];
    if (request.method === 'GET' && kind && url.searchParams.has('at')) {
      const record = await observationStore.replay({
        kind,
        lat: Number(url.searchParams.get('lat')),
        lon: Number(url.searchParams.get('lon')),
        at: url.searchParams.get('at'),
      });
      if (!record) return json(response, 404, { error: 'recorded_observation_unavailable' });
      response.setHeader('x-aethergrid-recorded-at', record.observedAt);
      response.setHeader('x-aethergrid-observation', record.receipt);
      return json(response, 200, record.payload);
    }
    if (request.method === 'GET' && kind) {
      const coordinate = validateCoordinates(
        url.searchParams.get('lat'),
        url.searchParams.get('lon'),
      );
      if (coordinate.valid)
        response.observation = {
          kind,
          coordinate: {
            lat: Number(url.searchParams.get('lat')),
            lon: Number(url.searchParams.get('lon')),
          },
        };
    }
    return false;
  }
}
