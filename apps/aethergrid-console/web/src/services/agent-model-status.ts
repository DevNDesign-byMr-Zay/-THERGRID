import {agentRuntimeMetadata,type AgentId} from './agent-client';
import {GRID_SKILLS} from './agent-grid-actions';

export interface AgentExecutionEvidence {receipt:string|null;executionStatus?:string;completedAt:string|null;provider:string|null;model:string|null;fallbackUsed:boolean;rateLimit?:Record<string,string>;retryAfterSeconds?:number|null}
export interface AgentModelStatus { agent: AgentId; provider: string | null; model: string | null; status: string; executionStatus?:string;rateLimit?:Record<string,string>;retryAfterSeconds?:number|null; skills?: string[]; lastExecution?:AgentExecutionEvidence|null;lastSuccessfulExecution?:AgentExecutionEvidence|null }
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;

function executionEvidence(value:unknown):AgentExecutionEvidence|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=object(value);
  return {receipt:text(row.receipt),completedAt:text(row.completedAt),provider:text(row.provider),model:text(row.model),fallbackUsed:row.fallbackUsed===true,...agentRuntimeMetadata(row)};
}

/** Configuration is backend-reported readiness, never proof of an execution. */
export function agentModelStatus(payload: unknown): AgentModelStatus[] {
  const agents = object(object(object(payload).ai).agents);
  return (['TEAM', 'AUREN', 'VÆLON', 'SOLVÆR'] as const).map(agent => {
    const row = object(agents[agent]);
    return {agent, provider: text(row.provider), model: text(row.model), status: text(row.status) ?? 'unavailable',...agentRuntimeMetadata(row),
      ...(Array.isArray(row.skills)?{skills:row.skills.filter((value):value is string=>typeof value==='string'&&(GRID_SKILLS as readonly string[]).includes(value))}:{}),
      ...('lastExecution'in row?{lastExecution:executionEvidence(row.lastExecution)}:{}),
      ...('lastSuccessfulExecution'in row?{lastSuccessfulExecution:executionEvidence(row.lastSuccessfulExecution)}:{})};
  });
}
