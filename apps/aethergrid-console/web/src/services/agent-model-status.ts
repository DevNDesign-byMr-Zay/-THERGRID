import type { AgentId } from './agent-client';

export interface AgentModelStatus { agent: AgentId; provider: string | null; model: string | null; status: string }
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;

/** Configuration is backend-reported readiness, never proof of an execution. */
export function agentModelStatus(payload: unknown): AgentModelStatus[] {
  const agents = object(object(object(payload).ai).agents);
  return (['TEAM', 'AUREN', 'VÆLON', 'SOLVÆR'] as const).map(agent => {
    const row = object(agents[agent]);
    return {agent, provider: text(row.provider), model: text(row.model), status: text(row.status) ?? 'unavailable'};
  });
}
