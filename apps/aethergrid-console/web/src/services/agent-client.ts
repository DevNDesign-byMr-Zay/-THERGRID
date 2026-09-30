export type AgentId = 'TEAM' | 'VÆLON' | 'AUREN' | 'SOLVÆR';

export interface AgentHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentRuntimeReceipt {
  agent: string;
  provider: string;
  model: string | null;
  fallbackUsed: boolean;
  error?: string | null;
  latencyMs: number;
  advisoryOnly: boolean;
}

export interface AgentContribution {
  agent: string;
  reply: string;
  receipt: string;
  runtime: AgentRuntimeReceipt;
}

export interface AgentResponse {
  reply: string;
  synthesis?: string;
  receipt: string;
  runtime: AgentRuntimeReceipt;
  contributions?: readonly AgentContribution[];
  advisoryOnly: boolean;
  evidence?: {
    id?: string;
    receipt?: string;
    title?: string;
    type?: string;
    status?: string;
  };
}

export interface AgentSpatialContext {
  region: string;
  view: string;
  temporalMode: string;
  temporalCursor: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  cityIdentity?: Readonly<Record<string, unknown>> | null;
  selectedEntity?: Readonly<Record<string, unknown>> | null;
  environment?: Readonly<Record<string, unknown>> | null;
  liveContext?: Readonly<Record<string, unknown>> | null;
}

export async function runAgent(
  agent: AgentId,
  message: string,
  context: AgentSpatialContext,
  history: readonly AgentHistoryItem[],
  signal?: AbortSignal
): Promise<AgentResponse> {
  const endpoint =
    agent === 'TEAM'
      ? '/api/aethergrid/team'
      : `/api/aethergrid/agents/${encodeURIComponent(agent)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      message,
      context,
      history: history.slice(-12)
    }),
    signal
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<AgentResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || `agent request failed with HTTP ${response.status}`);
  }

  const reply = String(payload.reply || payload.synthesis || '').trim();
  if (!reply) throw new Error('agent returned no operator-facing response');

  return {
    reply,
    synthesis: payload.synthesis,
    receipt: String(payload.receipt || ''),
    runtime: {
      agent: String(payload.runtime?.agent || agent),
      provider: String(payload.runtime?.provider || 'unknown'),
      model: payload.runtime?.model ? String(payload.runtime.model) : null,
      fallbackUsed: payload.runtime?.fallbackUsed === true,
      error: payload.runtime?.error ? String(payload.runtime.error) : null,
      latencyMs: Number(payload.runtime?.latencyMs || 0),
      advisoryOnly: true
    },
    contributions: Array.isArray(payload.contributions)
      ? payload.contributions
      : undefined,
    advisoryOnly: true,
    evidence: payload.evidence
  };
}
