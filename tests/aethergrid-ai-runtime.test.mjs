import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { createAgentRuntime } from '../apps/aethergrid-console/ai-runtime.mjs';

async function withFakeModelServer(run) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({
      url: request.url,
      authorization: request.headers.authorization || null,
      body,
    });

    response.setHeader('content-type', 'application/json');
    if (request.url === '/v1/chat/completions') {
      const content =
        body.model === 'team-model'
          ? 'TEAM MODEL SYNTHESIS: VÆLON, AUREN and SOLVÆR contributions reconciled.'
          : 'OPENAI-COMPATIBLE AUREN RESPONSE';
      response.end(
        JSON.stringify({
          id: 'fake-openai-request',
          choices: [{ message: { role: 'assistant', content } }],
          usage: { prompt_tokens: 11, completion_tokens: 7 },
        }),
      );
      return;
    }
    if (request.url === '/api/chat') {
      response.end(
        JSON.stringify({
          message: { role: 'assistant', content: 'OLLAMA SOLVÆR RESPONSE' },
          prompt_eval_count: 9,
          eval_count: 6,
        }),
      );
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run({ baseUrl: `http://127.0.0.1:${address.port}`, requests });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('replaceable model adapters call OpenAI-compatible and Ollama providers', async () => {
  await withFakeModelServer(async ({ baseUrl, requests }) => {
    const env = {
      AETHERGRID_AI_PROVIDER: 'local',
      AETHERGRID_AUREN_PROVIDER: 'openai-compatible',
      AETHERGRID_AUREN_MODEL: 'auren-model',
      AETHERGRID_AUREN_BASE_URL: `${baseUrl}/v1`,
      AETHERGRID_AUREN_API_KEY: 'test-secret-key',
      AETHERGRID_SOLVAER_PROVIDER: 'ollama',
      AETHERGRID_SOLVAER_MODEL: 'solvaer-model',
      AETHERGRID_SOLVAER_OLLAMA_URL: baseUrl,
      AETHERGRID_TEAM_PROVIDER: 'openai-compatible',
      AETHERGRID_TEAM_MODEL: 'team-model',
      AETHERGRID_TEAM_BASE_URL: `${baseUrl}/v1`,
      AETHERGRID_TEAM_API_KEY: 'team-secret-key',
    };
    const runtime = createAgentRuntime({ env });

    const summary = runtime.summary();
    assert.equal(summary.agents.AUREN.provider, 'openai-compatible');
    assert.equal(summary.agents.AUREN.model, 'auren-model');
    assert.equal(summary.agents.AUREN.status, 'configured');
    assert.equal(summary.agents['SOLVÆR'].provider, 'ollama');
    assert.equal(summary.agents.TEAM.model, 'team-model');
    const serialized = JSON.stringify(summary);
    assert.doesNotMatch(serialized, /test-secret-key/u);
    assert.doesNotMatch(serialized, /team-secret-key/u);

    const auren = await runtime.runAgent('AUREN', {
      message: 'Inspect spatial resilience.',
      context: { region: 'New York Metro', scenario: 'weather-event' },
    });
    assert.equal(auren.reply, 'OPENAI-COMPATIBLE AUREN RESPONSE');
    assert.equal(auren.runtime.provider, 'openai-compatible');
    assert.equal(auren.runtime.model, 'auren-model');
    assert.equal(auren.runtime.fallbackUsed, false);

    const solvaer = await runtime.runAgent('SOLVÆR', {
      message: 'Validate the scenario evidence.',
      context: { region: 'New York Metro', scenario: 'weather-event' },
    });
    assert.equal(solvaer.reply, 'OLLAMA SOLVÆR RESPONSE');
    assert.equal(solvaer.runtime.provider, 'ollama');
    assert.equal(solvaer.runtime.fallbackUsed, false);

    const team = await runtime.runTeam({
      message: 'Evaluate resilience and recommend next validation steps.',
      context: { region: 'New York Metro', scenario: 'weather-event' },
    });
    assert.equal(team.contributions.length, 3);
    assert.match(team.synthesis, /TEAM MODEL SYNTHESIS/u);
    assert.equal(team.runtime.provider, 'openai-compatible');
    assert.equal(team.runtime.model, 'team-model');
    assert.equal(team.runtime.fallbackUsed, false);

    const openAiRequests = requests.filter((item) => item.url === '/v1/chat/completions');
    assert.ok(openAiRequests.length >= 2);
    assert.ok(openAiRequests.some((item) => item.authorization === 'Bearer test-secret-key'));
    assert.ok(openAiRequests.some((item) => item.authorization === 'Bearer team-secret-key'));
    assert.ok(requests.some((item) => item.url === '/api/chat'));
  });
});

test('provider failure degrades to local advisory fallback with evidence', async () => {
  const runtime = createAgentRuntime({
    env: {
      AETHERGRID_AUREN_PROVIDER: 'openai-compatible',
      AETHERGRID_AUREN_MODEL: 'missing-provider-model',
      AETHERGRID_AUREN_BASE_URL: 'http://127.0.0.1:1/v1',
      AETHERGRID_AUREN_API_KEY: 'not-a-real-key',
      AETHERGRID_AUREN_TIMEOUT_MS: '50',
    },
  });

  const result = await runtime.runAgent('AUREN', {
    message: 'Inspect topology.',
    context: { region: 'New York Metro' },
  });

  assert.match(result.reply, /AUREN local fallback/u);
  assert.equal(result.runtime.fallbackUsed, true);
  assert.equal(result.runtime.provider, 'openai-compatible');
  assert.ok(typeof result.runtime.error === 'string' && result.runtime.error.length > 0);
  assert.match(result.receipt, /^[a-f0-9]{64}$/u);
});
