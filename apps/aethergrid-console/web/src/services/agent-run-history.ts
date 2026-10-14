import type { AgentId, AgentResponse, AgentSpatialContext } from './agent-client';

export interface AgentRunRecord {
  id: string;
  agent: AgentId;
  prompt: string;
  startedAt: string;
  completedAt: string;
  endpoint: string;
  context: { region: string; view: string; temporalMode: string; temporalCursor: string;
    coordinate: { latitude: number; longitude: number }; selectedEntityId: string | null; sourceFeatureId: string | null };
  status: 'completed' | 'failed' | 'stopped';
  error: string | null;
  response: AgentResponse | null;
}

export function createAgentRunRecord(agent: AgentId, prompt: string, context: AgentSpatialContext, response: AgentResponse, startedAt: string, completedAt: string): AgentRunRecord {
  const text = (value: unknown) => typeof value === 'string' ? value : null;
  return { id: `${agent}:${completedAt}:${crypto.randomUUID()}`, agent, prompt, startedAt, completedAt,
    endpoint: agent === 'TEAM' ? '/api/aethergrid/team' : `/api/aethergrid/agents/${encodeURIComponent(agent)}`,
    context: { region: context.region, view: context.view, temporalMode: context.temporalMode, temporalCursor: context.temporalCursor,
      coordinate: { ...context.coordinate }, selectedEntityId: text(context.selectedEntity?.id), sourceFeatureId: text(context.selectedEntity?.sourceFeatureId) },
    status: 'completed', error: null, response: structuredClone(response) };
}

export function createAgentUnfinishedRecord(agent: AgentId, prompt: string, context: AgentSpatialContext, status: 'failed' | 'stopped', error: string, startedAt: string, completedAt: string): AgentRunRecord {
  const text = (value: unknown) => typeof value === 'string' ? value : null;
  return {id: `${agent}:${completedAt}:${crypto.randomUUID()}`, agent, prompt, startedAt, completedAt,
    endpoint: agent === 'TEAM' ? '/api/aethergrid/team' : `/api/aethergrid/agents/${encodeURIComponent(agent)}`,
    context: {region: context.region, view: context.view, temporalMode: context.temporalMode, temporalCursor: context.temporalCursor,
      coordinate: {...context.coordinate}, selectedEntityId: text(context.selectedEntity?.id), sourceFeatureId: text(context.selectedEntity?.sourceFeatureId)},
    status, error, response: null};
}

export function appendAgentRun(runs: readonly AgentRunRecord[], record: AgentRunRecord): AgentRunRecord[] {
  return [...runs, record].slice(-8);
}

export function agentResponseState(response: AgentResponse): string {
  if (response.runtime.fallbackUsed) return 'LOCAL FALLBACK';
  return response.runtime.provider && response.runtime.provider !== 'unknown' && response.runtime.model ? 'PROVIDER RESPONSE' : 'UNVERIFIED RESPONSE';
}
