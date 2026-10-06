import { createHash } from 'node:crypto';

import { AGENT_DEFINITIONS, resolveAgentConfig, safeAgentConfig } from './agent-config.mjs';

function receipt(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function ensureHttpUrl(value, label) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must use http or https`);
  return url;
}

function localReply(agent, message, context = {}) {
  const region = context.region || 'current region';
  const scenario = context.scenario || 'current scenario';
  const metrics = context.metrics || {};
  const metricSummary = [
    Number.isFinite(Number(metrics.loadMw)) ? `load ${Math.round(Number(metrics.loadMw))} MW` : null,
    Number.isFinite(Number(metrics.generationMw))
      ? `generation ${Math.round(Number(metrics.generationMw))} MW`
      : null,
    Number.isFinite(Number(metrics.renewablePercent))
      ? `renewables ${Number(metrics.renewablePercent).toFixed(1)}%`
      : null,
  ]
    .filter(Boolean)
    .join(', ');

  if (agent.id === 'VÆLON') {
    return `VÆLON local fallback: for ${region} / ${scenario}, evaluate “${message}” as a bounded optimization problem. Preserve a classical baseline, quantify cost/emissions/reliability tradeoffs, and reject any candidate that violates reserve or evidence constraints.${metricSummary ? ` Current context: ${metricSummary}.` : ''}`;
  }
  if (agent.id === 'AUREN') {
    return `AUREN local fallback: interpret “${message}” against the ${region} 4D spatial graph and ${scenario} context. Inspect topology, correlated risk, temporal changes and affected nodes before drawing an operator-facing conclusion.${metricSummary ? ` Current context: ${metricSummary}.` : ''}`;
  }
  if (agent.id === 'SOLVÆR') {
    return `SOLVÆR local fallback: treat “${message}” as a simulation/evidence request for ${region} / ${scenario}. Define assumptions, comparison baseline, reproducible inputs, uncertainty and the evidence required before a recommendation can be promoted.`;
  }
  return `ÆTHERGRID team local synthesis: VÆLON should bound optimization tradeoffs, AUREN should inspect the 4D spatial implications, and SOLVÆR should validate the proposal with reproducible evidence. The combined result remains advisory-only. Request: “${message}”.`;
}

async function callOpenAiCompatible(agent, messages, signal) {
  const base = ensureHttpUrl(agent.openAiBaseUrl, 'OpenAI-compatible base URL');
  if (!agent.openAiApiKey) throw new Error('OpenAI-compatible API key is not configured');
  if (!agent.model) throw new Error('OpenAI-compatible model is not configured');
  const url = new URL('./chat/completions', base.href.endsWith('/') ? base.href : `${base.href}/`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${agent.openAiApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: agent.model,
      messages: messages.map(({ role, content }) => ({ role, content })),
      temperature: 0.2,
    }),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `provider returned HTTP ${response.status}`);
  }
  const text = payload?.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('provider returned no assistant text');
  return {
    text,
    usage: payload.usage || null,
    providerRequestId: response.headers.get('x-request-id') || payload.id || null,
  };
}

async function callOllama(agent, messages, signal) {
  const base = ensureHttpUrl(agent.ollamaBaseUrl, 'Ollama base URL');
  if (!agent.model) throw new Error('Ollama model is not configured');
  const url = new URL('./api/chat', base.href.endsWith('/') ? base.href : `${base.href}/`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: agent.model, messages, stream: false }),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Ollama returned HTTP ${response.status}`);
  const text = payload?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('Ollama returned no assistant text');
  return {
    text,
    usage: {
      promptTokens: payload.prompt_eval_count ?? null,
      completionTokens: payload.eval_count ?? null,
    },
    providerRequestId: null,
  };
}

async function providerComplete(agent, messages, signal) {
  if (agent.provider === 'openai-compatible') return callOpenAiCompatible(agent, messages, signal);
  if (agent.provider === 'ollama') return callOllama(agent, messages, signal);
  return { text: localReply(agent, messages.at(-1)?.content || '', messages.at(-1)?.context || {}), usage: null, providerRequestId: null };
}

function contextMessage(context = {}) {
  return {
    role: 'system',
    content: `Operator context JSON (advisory, not authoritative model truth): ${JSON.stringify(context)}`,
  };
}

export function createAgentRuntime({ env = process.env, now = () => Date.now() } = {}) {
  let config = resolveAgentConfig(env);

  function reload(nextEnv = env) {
    config = resolveAgentConfig(nextEnv);
    return summary();
  }

  function summary() {
    const agents = safeAgentConfig(config);
    return {
      mode: 'replaceable-provider-runtime',
      liveProviders: Object.values(agents).some((item) => item.provider !== 'local' && item.status === 'configured'),
      supportedProviders: ['local', 'openai-compatible', 'ollama'],
      agents,
    };
  }

  async function runAgent(id, { message, context = {}, history = [] } = {}) {
    const agent = config[id];
    if (!agent || id === 'TEAM') throw new Error(`unknown individual agent: ${id}`);
    const startedAt = now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('model request timed out')), agent.timeoutMs);
    const messages = [
      { role: 'system', content: agent.systemPrompt },
      contextMessage(context),
      ...history
        .filter((item) => ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
        .slice(-12),
      { role: 'user', content: String(message || ''), context },
    ];
    let fallbackUsed = false;
    let result;
    let error = null;
    try {
      result = await providerComplete(agent, messages, controller.signal);
    } catch (providerError) {
      fallbackUsed = true;
      error = providerError instanceof Error ? providerError.message : String(providerError);
      result = {
        text: localReply(agent, String(message || ''), context),
        usage: null,
        providerRequestId: null,
      };
    } finally {
      clearTimeout(timeout);
    }
    const completedAt = now();
    const record = {
      agent: id,
      role: agent.role,
      provider: agent.provider,
      model: agent.model || null,
      fallbackUsed,
      error,
      latencyMs: completedAt - startedAt,
      usage: result.usage,
      providerRequestId: result.providerRequestId,
      advisoryOnly: true,
    };
    return {
      reply: result.text,
      runtime: record,
      receipt: receipt({ message, context, record, reply: result.text, completedAt }),
    };
  }

  async function runTeam({ message, context = {}, history = [] } = {}) {
    const ids = ['VÆLON', 'AUREN', 'SOLVÆR'];
    const contributions = await Promise.all(
      ids.map(async (id) => {
        const result = await runAgent(id, { message, context, history });
        return { id, ...result };
      }),
    );
    const team = config.TEAM;
    const synthesisPrompt = [
      `Original operator request: ${message}`,
      '',
      ...contributions.flatMap((item) => [
        `${item.id} contribution:`,
        item.reply,
        '',
      ]),
      'Synthesize the contributions into one operator-facing response. Identify disagreements, uncertainty, missing evidence and next validation steps. Keep the result advisory-only.',
    ].join('\n');

    const startedAt = now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('team synthesis timed out')), team.timeoutMs);
    let fallbackUsed = false;
    let synthesisResult;
    let error = null;
    try {
      if (team.provider === 'local') {
        synthesisResult = {
          text:
            `TEAM SYNTHESIS\n\n` +
            contributions.map((item) => `${item.id}: ${item.reply}`).join('\n\n') +
            '\n\nCombined next step: reconcile optimization tradeoffs with the spatial analysis, then validate the candidate through SOLVÆR evidence before operator promotion. Authority remains advisory-only.',
          usage: null,
          providerRequestId: null,
        };
      } else {
        synthesisResult = await providerComplete(
          team,
          [
            { role: 'system', content: team.systemPrompt },
            contextMessage(context),
            { role: 'user', content: synthesisPrompt, context },
          ],
          controller.signal,
        );
      }
    } catch (providerError) {
      fallbackUsed = true;
      error = providerError instanceof Error ? providerError.message : String(providerError);
      synthesisResult = {
        text:
          `TEAM SYNTHESIS\n\n` +
          contributions.map((item) => `${item.id}: ${item.reply}`).join('\n\n') +
          '\n\nCombined boundary: compare candidate actions against classical/simulation evidence and require operator review before promotion.',
        usage: null,
        providerRequestId: null,
      };
    } finally {
      clearTimeout(timeout);
    }
    const completedAt = now();
    const runtime = {
      agent: 'TEAM',
      provider: team.provider,
      model: team.model || null,
      fallbackUsed,
      error,
      latencyMs: completedAt - startedAt,
      advisoryOnly: true,
    };
    return {
      synthesis: synthesisResult.text,
      reply: synthesisResult.text,
      contributions: contributions.map((item) => ({
        agent: item.id,
        reply: item.reply,
        receipt: item.receipt,
        runtime: item.runtime,
      })),
      runtime,
      receipt: receipt({
        message,
        context,
        contributions: contributions.map((item) => item.receipt),
        runtime,
        synthesis: synthesisResult.text,
        completedAt,
      }),
    };
  }

  return { reload, runAgent, runTeam, summary };
}
