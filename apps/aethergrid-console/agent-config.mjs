export const AGENT_DEFINITIONS = Object.freeze({
  'VÆLON': Object.freeze({
    envPrefix: 'AETHERGRID_VAELON',
    role: 'Optimization & Scenario Exploration',
    defaultGroqModel: 'openai/gpt-oss-120b',
    systemPrompt:
      'You are VÆLON inside ÆTHERGRID. Focus on bounded optimization, operating scenarios, constraints, tradeoffs and classical-baseline comparison. Never claim authority to actuate infrastructure. Distinguish observed state, assumptions and recommendations.',
  }),
  AUREN: Object.freeze({
    envPrefix: 'AETHERGRID_AUREN',
    role: 'Semantic Analysis & Spatial Intelligence',
    defaultGroqModel: 'qwen/qwen3.8-27b',
    systemPrompt:
      'You are AUREN inside ÆTHERGRID. Focus on semantic interpretation, 4D spatial relationships, topology, resilience, risk correlation and operator-readable context. Never invent authoritative telemetry or physical actuation authority.',
  }),
  'SOLVÆR': Object.freeze({
    envPrefix: 'AETHERGRID_SOLVAER',
    role: 'Simulation & Evidence Generation',
    defaultGroqModel: 'qwen/qwen3.8-27b',
    systemPrompt:
      'You are SOLVÆR inside ÆTHERGRID. Focus on simulation design, reproducibility, evidence, provenance, validation, uncertainty and comparison against historical or classical baselines. Never promote a recommendation without evidence.',
  }),
  TEAM: Object.freeze({
    envPrefix: 'AETHERGRID_TEAM',
    role: 'Multi-Agent Synthesis',
    defaultGroqModel: 'openai/gpt-oss-120b',
    systemPrompt:
      'You are the ÆTHERGRID team synthesizer. Reconcile VÆLON optimization, AUREN spatial/semantic analysis and SOLVÆR evidence. Produce one concise operator-facing synthesis, call out disagreements or missing evidence, and preserve the advisory-only authority boundary.',
  }),
});

const DEFAULTS = Object.freeze({
  provider: 'local',
  timeoutMs: 45000,
  openAiBaseUrl: 'https://api.openai.com/v1',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
});

function normalizeProvider(value) {
  const provider = String(value || 'local').trim().toLowerCase();
  if (provider === 'openai' || provider === 'openai-compatible' || provider === 'groq') return 'openai-compatible';
  if (provider === 'ollama') return 'ollama';
  return 'local';
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveAgentConfig(env = process.env) {
  const sharedProvider = normalizeProvider(env.AETHERGRID_AI_PROVIDER || DEFAULTS.provider);
  const sharedModel = env.AETHERGRID_AI_MODEL || '';
  const sharedTimeout = numberFromEnv(env.AETHERGRID_AI_TIMEOUT_MS, DEFAULTS.timeoutMs);

  return Object.fromEntries(
    Object.entries(AGENT_DEFINITIONS).map(([id, definition]) => {
      const prefix = definition.envPrefix;
      const provider = normalizeProvider(env[`${prefix}_PROVIDER`] || sharedProvider);
      const model =
        env[`${prefix}_MODEL`] ||
        sharedModel ||
        (provider === 'openai-compatible' ? definition.defaultGroqModel : provider === 'ollama' ? 'llama3.2' : `local-${id.toLowerCase()}`);
      return [
        id,
        {
          id,
          role: definition.role,
          systemPrompt: definition.systemPrompt,
          provider,
          model,
          defaultGroqModel: definition.defaultGroqModel,
          timeoutMs: numberFromEnv(env[`${prefix}_TIMEOUT_MS`], sharedTimeout),
          openAiBaseUrl:
            env[`${prefix}_BASE_URL`] ||
            env.AETHERGRID_OPENAI_BASE_URL ||
            env.AETHERGRID_AI_BASE_URL ||
            DEFAULTS.openAiBaseUrl,
          openAiApiKey:
            env[`${prefix}_API_KEY`] ||
            env.AETHERGRID_OPENAI_API_KEY ||
            env.AETHERGRID_AI_API_KEY ||
            '',
          ollamaBaseUrl:
            env[`${prefix}_OLLAMA_URL`] ||
            env.AETHERGRID_OLLAMA_BASE_URL ||
            DEFAULTS.ollamaBaseUrl,
        },
      ];
    }),
  );
}

export function safeAgentConfig(config) {
  return Object.fromEntries(
    Object.entries(config).map(([id, item]) => [
      id,
      {
        id,
        role: item.role,
        provider: item.provider,
        model: item.model || null,
        timeoutMs: item.timeoutMs,
        status:
          item.provider === 'local'
            ? 'local-fallback'
            : item.provider === 'openai-compatible'
              ? item.model && item.openAiApiKey
                ? 'configured'
                : 'unconfigured'
              : item.provider === 'ollama' && item.model
                ? 'configured'
                : 'unconfigured',
      },
    ]),
  );
}
