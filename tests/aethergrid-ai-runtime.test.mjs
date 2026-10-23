import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { createAgentRuntime } from '../apps/aethergrid-console/ai-runtime.mjs';
import { resolveAgentConfig, safeAgentConfig } from '../apps/aethergrid-console/agent-config.mjs';

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
      if (
        body.messages.some((message) =>
          Object.keys(message).some((key) => !['role', 'content'].includes(key)),
        )
      ) {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: { message: 'unsupported chat message field' } }));
        return;
      }
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

test('specialists execute trusted read-only tools and TEAM retains citations', async () => {
  const runtime = createAgentRuntime({
    env: {},
    tools: {
      readObservations: async () => [
        {
          receipt: 'a'.repeat(64),
          kind: 'weather',
          observedAt: '2026-10-14T07:00:00Z',
          payload: { temperatureC: 20 },
        },
      ],
    },
  });
  const result = await runtime.runAgent('AUREN', {
    message: 'Inspect risk',
    context: { citations: [{ receipt: 'forged' }] },
  });
  assert.equal(result.citations[0].receipt, 'a'.repeat(64));
  assert.equal(result.toolResults[0].tool, 'readObservations');
  assert.equal(
    result.citations.some((c) => c.receipt === 'forged'),
    false,
  );
  const team = await runtime.runTeam({ message: 'Compare' });
  assert.equal(team.citations[0].receipt, 'a'.repeat(64));
  assert.ok(team.contributions.every((c) => c.citations.length === 1));
});

test('one private Groq key configures four real agents without exposing credentials', () => {
  const config = resolveAgentConfig({ AETHERGRID_GROQ_API_KEY: 'test-only-private-key' });
  for (const agent of ['TEAM', 'VÆLON', 'AUREN', 'SOLVÆR']) {
    assert.equal(config[agent].provider, 'openai-compatible');
    assert.equal(config[agent].model, 'openai/gpt-oss-20b');
    assert.equal(config[agent].openAiBaseUrl, 'https://api.groq.com/openai/v1');
    assert.equal(config[agent].openAiApiKey, 'test-only-private-key');
    assert.equal(safeAgentConfig(config)[agent].status, 'configured');
  }
  assert.doesNotMatch(JSON.stringify(safeAgentConfig(config)), /test-only-private-key/u);
  assert.equal(
    resolveAgentConfig({
      AETHERGRID_AI_PROVIDER: 'local',
      AETHERGRID_GROQ_API_KEY: 'test-only-private-key',
    }).AUREN.provider,
    'local',
  );
});

async function withSkillServer(handler, run) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    requests.push(body);
    response.setHeader('content-type', 'application/json');
    await handler(body, response, requests.length);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run({
      requests,
      env: {
        AETHERGRID_AI_PROVIDER: 'openai-compatible',
        AETHERGRID_AI_MODEL: 'skill-model',
        AETHERGRID_AI_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`,
        AETHERGRID_AI_API_KEY: 'private-test-key',
      },
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function sendCompletion(response, message) {
  response.end(JSON.stringify({ id: 'skill-request', choices: [{ message }] }));
}

function toolCall(name, args, id = 'call-1') {
  return { id, type: 'function', function: { name, arguments: JSON.stringify(args) } };
}

test('model-selected grid skills roundtrip through tool messages and produce validated actions with execution evidence', async () => {
  await withSkillServer(
    (body, response, count) => {
      if (count === 1)
        sendCompletion(response, {
          role: 'assistant',
          content: null,
          tool_calls: [toolCall('set_layer', { layer: 'weather', enabled: true })],
        });
      else
        sendCompletion(response, {
          role: 'assistant',
          content: 'Weather layer selected for inspection.',
        });
    },
    async ({ env, requests }) => {
      const runtime = createAgentRuntime({ env });
      assert.equal(runtime.summary().liveProviders, false);
      assert.equal(runtime.summary().agents.AUREN.executionStatus, 'unverified');
      const result = await runtime.runAgent('AUREN', { message: 'Show weather' });
      assert.deepEqual(result.actions, [{ type: 'set_layer', layer: 'weather', enabled: true }]);
      assert.equal(result.runtime.fallbackUsed, false);
      assert.equal(requests.length, 2);
      assert.ok(requests[0].tools.some((tool) => tool.function.name === 'set_layer'));
      assert.equal(requests[1].messages.at(-1).role, 'tool');
      assert.equal(requests[1].messages.at(-1).tool_call_id, 'call-1');
      assert.equal(runtime.summary().agents.AUREN.lastExecution.receipt, result.receipt);
      assert.equal(runtime.summary().agents.AUREN.executionStatus, 'succeeded');
      assert.equal(runtime.summary().liveProviders, true);
      assert.doesNotMatch(JSON.stringify(result), /private-test-key/u);
    },
  );
});

test('malformed tool arguments stop immediately without application actions', async () => {
  await withSkillServer(
    (body, response) =>
      sendCompletion(response, {
        role: 'assistant',
        content: null,
        tool_calls: [
          toolCall('set_layer', { layer: 'weather', enabled: 'yes' }),
          toolCall('eval', { code: 'bad' }, 'call-2'),
          toolCall('set_layer', { layer: 'weather', enabled: true, unexpected: 'bad' }, 'call-3'),
        ],
      }),
    async ({ env, requests }) => {
      const result = await createAgentRuntime({ env }).runAgent('AUREN', {
        message: 'Show weather',
      });
      assert.deepEqual(result.actions, []);
      assert.equal(requests.length, 1);
      assert.equal(result.runtime.fallbackUsed, true);
      assert.ok(result.toolResults.some((item) => item.ok === false));
      assert.match(result.runtime.error, /invalid/u);
      assert.equal(result.toolResults.length, 1);
    },
  );
});

test('shared provider key cooldown honors retry-after without retry storms and exposes sanitized quota headers', async () => {
  let clock = Date.parse('2026-10-23T10:00:00Z');
  await withSkillServer(
    (body, response, count) => {
      if (count === 1) {
        response.statusCode = 429;
        response.setHeader('retry-after', '45');
        response.setHeader('x-ratelimit-remaining-tokens', '0');
        response.end(JSON.stringify({ error: { message: 'rate limit private-test-key' } }));
      } else sendCompletion(response, { role: 'assistant', content: 'Recovered' });
    },
    async ({ env, requests }) => {
      const runtime = createAgentRuntime({ env, now: () => clock });
      const first = await runtime.runAgent('VÆLON', { message: 'Inspect' });
      assert.equal(first.runtime.retryAfterSeconds, 45);
      assert.equal(first.runtime.rateLimit['x-ratelimit-remaining-tokens'], '0');
      assert.doesNotMatch(JSON.stringify(first), /private-test-key/u);
      const second = await runtime.runAgent('AUREN', { message: 'Inspect' });
      assert.equal(requests.length, 1);
      assert.equal(second.runtime.executionStatus, 'cooldown');
      assert.equal(second.runtime.retryAfterSeconds, 45);
      assert.equal(runtime.summary().agents['SOLVÆR'].executionStatus, 'cooldown');
      clock += 46_000;
      const recovered = await runtime.runAgent('AUREN', { message: 'Inspect' });
      assert.equal(requests.length, 2);
      assert.equal(recovered.runtime.executionStatus, 'succeeded');
    },
  );
});

test('TEAM synthesizes independently executed specialists and exposes partial failures', async () => {
  await withSkillServer(
    (body, response) => {
      if (body.model === 'broken') {
        response.statusCode = 503;
        response.end(JSON.stringify({ error: { message: 'temporarily unavailable' } }));
      } else sendCompletion(response, { role: 'assistant', content: `${body.model} execution` });
    },
    async ({ env, requests }) => {
      const runtime = createAgentRuntime({
        env: {
          ...env,
          AETHERGRID_VAELON_MODEL: 'vaelon',
          AETHERGRID_AUREN_MODEL: 'auren',
          AETHERGRID_SOLVAER_MODEL: 'broken',
          AETHERGRID_TEAM_MODEL: 'team',
        },
      });
      const result = await runtime.runTeam({ message: 'Assess' });
      assert.equal(result.runtime.executionStatus, 'partial-failure');
      assert.equal(result.contributions.length, 3);
      assert.equal(
        result.contributions.find((item) => item.agent === 'SOLVÆR').runtime.fallbackUsed,
        true,
      );
      assert.deepEqual(
        new Set(requests.map((item) => item.model)),
        new Set(['vaelon', 'auren', 'broken', 'team']),
      );
      const synthesis = requests.find((item) => item.model === 'team').messages.at(-1).content;
      assert.match(synthesis, /failed|fallback/u);
      assert.equal(runtime.summary().agents.TEAM.lastExecution.receipt, result.receipt);
    },
  );
});

test('tool actions are discarded when the final provider round fails', async () => {
  await withSkillServer(
    (body, response, count) => {
      if (count === 1)
        sendCompletion(response, {
          role: 'assistant',
          content: null,
          tool_calls: [
            toolCall('focus_location', { latitude: 35, longitude: 139, label: 'Tokyo' }),
          ],
        });
      else {
        response.statusCode = 503;
        response.end('{}');
      }
    },
    async ({ env, requests }) => {
      const result = await createAgentRuntime({ env }).runAgent('AUREN', {
        message: 'Focus Tokyo',
      });
      assert.equal(result.runtime.executionStatus, 'failed');
      assert.deepEqual(result.actions, []);
      assert.equal(result.toolResults[0].ok, true);
      assert.ok(requests.every((item) => item.max_tokens === 512));
    },
  );
});

test('TEAM shares quota cooldown across concurrent specialists and keeps the failure visible', async () => {
  await withSkillServer(
    (body, response) => {
      response.statusCode = 429;
      response.setHeader('retry-after', '120');
      response.end('{}');
    },
    async ({ env, requests }) => {
      const result = await createAgentRuntime({ env }).runTeam({ message: 'Inspect' });
      assert.equal(requests.length, 1);
      assert.ok(result.contributions.every((item) => item.runtime.executionStatus === 'cooldown'));
      assert.equal(result.runtime.executionStatus, 'cooldown');
      assert.deepEqual(result.actions, []);
    },
  );
});

test('all model inputs distinguish illustrative metrics from observed telemetry and TEAM explicitly reports a failed specialist', async () => {
  await withSkillServer(
    (body, response) => {
      if (body.model === 'broken') {
        response.statusCode = 503;
        response.end('{}');
      } else sendCompletion(response, { role: 'assistant', content: 'Concise response.' });
    },
    async ({ env, requests }) => {
      const runtime = createAgentRuntime({ env: { ...env, AETHERGRID_SOLVAER_MODEL: 'broken' } });
      const result = await runtime.runTeam({
        message: 'Assess',
        context: { metricsBasis: 'illustrative-local-model', metrics: { loadMw: 100 } },
      });
      assert.match(requests[0].messages[0].content, /illustrative.*not measured telemetry/iu);
      assert.match(result.reply, /SOLVÆR.*failed/u);
      assert.ok(requests.some((item) => item.max_tokens === 768));
    },
  );
});

test('model prompt budgets bound oversized context, observations, history and TEAM inputs with visible truncation', async () => {
  await withSkillServer(
    (body, response) =>
      sendCompletion(response, { role: 'assistant', content: 'Bounded response' }),
    async ({ env, requests }) => {
      const records = Array.from({ length: 20 }, (_, index) => ({
        receipt: String(index).padStart(64, 'a'),
        kind: 'weather',
        observedAt: '2026-10-23T10:00:00Z',
        payload: { description: 'x'.repeat(100_000) },
      }));
      const runtime = createAgentRuntime({ env, tools: { readObservations: async () => records } });
      const result = await runtime.runTeam({
        message: 'x'.repeat(100_000),
        context: { region: 'x'.repeat(100_000), metricsBasis: 'illustrative-local-model' },
        history: Array.from({ length: 12 }, () => ({ role: 'user', content: 'x'.repeat(100_000) })),
      });
      for (const request of requests) {
        assert.ok(
          request.messages.reduce((size, item) => size + String(item.content).length, 0) <= 12_000,
        );
        assert.match(JSON.stringify(request.messages), /truncated/iu);
      }
      assert.ok(result.contributions.every((item) => item.citations.length < 20));
    },
  );
});

test('latest execution failure preserves separate last successful provider receipt', async () => {
  await withSkillServer(
    (body, response, count) => {
      if (count === 1) sendCompletion(response, { role: 'assistant', content: 'Verified' });
      else {
        response.statusCode = 503;
        response.end('{}');
      }
    },
    async ({ env }) => {
      const runtime = createAgentRuntime({ env });
      const good = await runtime.runAgent('AUREN', { message: 'Inspect' });
      const failed = await runtime.runAgent('AUREN', { message: 'Inspect' });
      const status = runtime.summary().agents.AUREN;
      assert.equal(status.lastExecution.receipt, failed.receipt);
      assert.equal(status.lastSuccessfulExecution.receipt, good.receipt);
      assert.equal(status.executionStatus, 'failed');
    },
  );
});

test('recorded observation metadata without payload remains available with its citation', async () => {
  const runtime = createAgentRuntime({
    env: {},
    tools: {
      readObservations: async () => [
        { receipt: 'b'.repeat(64), kind: 'weather', observedAt: '2026-10-23T10:00:00Z' },
      ],
    },
  });
  const result = await runtime.runAgent('AUREN', { message: 'Inspect' });
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].receipt, 'b'.repeat(64));
});

test('shared credential cooldown covers equivalent base URL spellings and HTTP-date retry-after', async () => {
  const clock = Date.parse('2026-10-23T10:00:00Z');
  await withSkillServer(
    (body, response) => {
      response.statusCode = 429;
      response.setHeader('retry-after', 'Fri, 23 Oct 2026 10:01:30 GMT');
      response.end('{}');
    },
    async ({ env, requests }) => {
      const runtime = createAgentRuntime({
        env: { ...env, AETHERGRID_AUREN_BASE_URL: `${env.AETHERGRID_AI_BASE_URL}/` },
        now: () => clock,
      });
      const first = await runtime.runAgent('VÆLON', { message: 'Inspect' });
      assert.equal(first.runtime.retryAfterSeconds, 90);
      const second = await runtime.runAgent('AUREN', { message: 'Inspect' });
      assert.equal(second.runtime.executionStatus, 'cooldown');
      assert.equal(requests.length, 1);
    },
  );
});

test('the shipped local env example allows one Groq key to activate every specialist', async () => {
  const { readFile } = await import('node:fs/promises');
  const sample = await readFile(
    new URL('../apps/aethergrid-console/.env.example', import.meta.url),
    'utf8',
  );
  const env = Object.fromEntries(
    sample
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const split = line.indexOf('=');
        return [line.slice(0, split), line.slice(split + 1).trim()];
      }),
  );
  env.AETHERGRID_GROQ_API_KEY = 'test-only-manifest-secret';
  const config = resolveAgentConfig(env);
  for (const id of ['VÆLON', 'AUREN', 'SOLVÆR', 'TEAM']) {
    assert.equal(config[id].provider, 'openai-compatible');
    assert.equal(config[id].openAiBaseUrl, 'https://api.groq.com/openai/v1');
    assert.equal(config[id].openAiApiKey, 'test-only-manifest-secret');
  }
});

test('a mixed invalid and valid model tool batch cannot produce any application actions', async () => {
  await withSkillServer(
    (body, response, count) =>
      sendCompletion(
        response,
        count === 1
          ? {
              role: 'assistant',
              content: null,
              tool_calls: [
                toolCall('set_layer', { layer: 'grid', enabled: 'yes' }),
                toolCall('set_view', { view: 'grid' }, 'call-2'),
              ],
            }
          : { role: 'assistant', content: 'Grid changed' },
      ),
    async ({ env, requests }) => {
      const result = await createAgentRuntime({ env }).runAgent('AUREN', { message: 'Show grid' });
      assert.deepEqual(result.actions, []);
      assert.equal(result.runtime.executionStatus, 'failed');
      assert.equal(requests.length, 1);
    },
  );
});

test('bounded context and inspection preserve every layer plus selection, time and telemetry provenance', async () => {
  const { GRID_LAYERS } = await import('../apps/aethergrid-console/agent-grid-skills.mjs');
  const layers = GRID_LAYERS.map((id, index) => ({ id, visible: index % 2 === 0 }));
  await withSkillServer(
    (body, response, count) =>
      sendCompletion(
        response,
        count === 1
          ? {
              role: 'assistant',
              content: null,
              tool_calls: [toolCall('inspect_context', {})],
            }
          : { role: 'assistant', content: 'Inspected' },
      ),
    async ({ env, requests }) => {
      const result = await createAgentRuntime({ env }).runAgent('AUREN', {
        message: 'Inspect grid context',
        context: {
          ...Object.fromEntries(
            Array.from({ length: 20 }, (_, i) => [`extra${i}`, 'x'.repeat(200)]),
          ),
          region: 'Tokyo',
          layers,
          selectedEntity: {
            id: 'osm:way:42',
            kind: 'power',
            properties: { description: 'x'.repeat(2000) },
          },
          hazards: { count: 1 },
          transit: { vehicleCount: 3 },
          hydrology: { observedStageFeet: 5 },
          temporalMode: 'historical',
          temporalCursor: '2026-10-22T12:00:00Z',
          metricsBasis: 'illustrative-local-model',
          observationsRequiredForLiveClaims: true,
        },
      });
      assert.equal(result.runtime.executionStatus, 'succeeded');
      const prompt = requests[0].messages.find((item) =>
        item.content.startsWith('Untrusted operator context JSON'),
      ).content;
      const actual = JSON.parse(prompt.slice(prompt.indexOf('{')));
      assert.deepEqual(actual.layers, layers);
      assert.equal(actual.selectedEntity.id, 'osm:way:42');
      assert.equal(actual.details.hazards.count, 1);
      assert.equal(actual.details.transit.vehicleCount, 3);
      assert.equal(actual.details.hydrology.observedStageFeet, 5);
      assert.equal(actual.metricsBasis, 'illustrative-local-model');
      assert.equal(actual.temporalCursor, '2026-10-22T12:00:00Z');
      assert.equal(actual.observationsRequiredForLiveClaims, true);
      const tool = JSON.parse(requests[1].messages.find((item) => item.role === 'tool').content);
      assert.deepEqual(tool.result.context.layers, layers);
      assert.equal(tool.result.context.selectedEntity.id, 'osm:way:42');
    },
  );
});

test('repeated valid tool requests stop after three provider rounds without applying partial actions', async () => {
  await withSkillServer(
    (body, response, count) =>
      sendCompletion(response, {
        role: 'assistant',
        content: null,
        tool_calls: [toolCall('set_view', { view: 'grid' }, `call-${count}`)],
      }),
    async ({ env, requests }) => {
      const result = await createAgentRuntime({ env }).runAgent('AUREN', { message: 'Show grid' });
      assert.equal(requests.length, 3);
      assert.equal(result.runtime.executionStatus, 'failed');
      assert.deepEqual(result.actions, []);
      assert.match(result.runtime.error, /limit/u);
    },
  );
});
