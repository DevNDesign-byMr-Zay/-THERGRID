import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

test('agent HTTP evidence distinguishes provider execution from local and failed responses', async () => {
  const requests = [];
  const model = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const payload = JSON.parse(raw);
    requests.push(payload);
    response.setHeader('content-type', 'application/json');
    if (payload.messages.at(-1).content === 'FAIL') {
      response.writeHead(401);
      response.end(JSON.stringify({ error: { message: 'test credential rejected' } }));
    } else {
      response.end(
        JSON.stringify({ id: 'http-test-receipt', choices: [{ message: { content: 'READY' } }] }),
      );
    }
  });
  await new Promise((resolve) => model.listen(0, '127.0.0.1', resolve));
  process.env.AETHERGRID_AI_PROVIDER = 'local';
  process.env.AETHERGRID_AUREN_PROVIDER = 'openai-compatible';
  process.env.AETHERGRID_AUREN_MODEL = 'test-model';
  process.env.AETHERGRID_AUREN_BASE_URL = `http://127.0.0.1:${model.address().port}/v1`;
  process.env.AETHERGRID_AUREN_API_KEY = 'test-only-private-key';
  const { server } = await import('../apps/aethergrid-console/server.mjs');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (id, input) =>
    fetch(`${base}/api/aethergrid/agents/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  try {
    const good = await (
      await post('AUREN', {
        message: 'READY',
        context: {
          region: 'Tokyo',
          selectedEntity: { id: 'osm:way:1' },
          temporalMode: 'historical',
          temporalCursor: '2026-10-20T00:00:00Z',
        },
      })
    ).json();
    assert.equal(good.evidence.status, 'VERIFIED');
    assert.equal(good.evidence.details.region, 'Tokyo');
    assert.equal(good.evidence.details.temporalMode, 'historical');
    const context = JSON.parse(
      requests[0].messages
        .find((item) => item.content?.startsWith('Untrusted operator context JSON'))
        .content.split(': ')
        .slice(1)
        .join(': '),
    );
    assert.equal(context.selectedEntity.id, 'osm:way:1');
    assert.equal(context.metricsBasis, 'illustrative-local-model');
    assert.equal(context.observationsRequiredForLiveClaims, true);
    const local = await (await post('VÆLON', { message: 'READY' })).json();
    assert.equal(local.evidence.status, 'LOCAL_FALLBACK');
    const failed = await (await post('AUREN', { message: 'FAIL' })).json();
    assert.equal(failed.evidence.status, 'LOCAL_FALLBACK');
    assert.equal(failed.runtime.fallbackUsed, true);
    assert.doesNotMatch(JSON.stringify(failed), /test-only-private-key/);
    const invalid = await post('unknown', { message: 'READY' });
    assert.equal(invalid.status, 400);
    const empty = await post('AUREN', { message: ' ' });
    assert.equal(empty.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => model.close(resolve));
  }
});
