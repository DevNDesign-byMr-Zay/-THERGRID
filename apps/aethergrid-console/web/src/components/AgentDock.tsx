import { useEffect, useMemo, useRef, useState } from 'react';
import { AGENT_ROLES, BRAND } from './brand';
import { AgentModelPanel } from './AgentModelPanel';

import {
  runAgent,
  type AgentHistoryItem,
  type AgentId,
  type AgentSpatialContext
} from '../services/agent-client';
import { agentResponseState, appendAgentRun, createAgentRunRecord, createAgentUnfinishedRecord, type AgentRunRecord } from '../services/agent-run-history';

const AGENTS: readonly AgentId[] = ['TEAM', 'AUREN', 'VÆLON', 'SOLVÆR'];

export interface AgentHandoffRequest {
  id: number;
  agent: AgentId;
  prompt: string;
}

interface AgentDockProps {
  context: AgentSpatialContext;
  active?: boolean;
  handoff?: AgentHandoffRequest | null;
  onEvidence?(id: string): void;
  onComparison?(): void;
}

export function AgentDock({ context, active = true, handoff = null, onEvidence, onComparison }: AgentDockProps) {
  const [agent, setAgent] = useState<AgentId>('TEAM');
  const [draft, setDraft] = useState('');
  const [histories, setHistories] = useState<Record<AgentId, AgentHistoryItem[]>>({
    TEAM: [],
    AUREN: [],
    'VÆLON': [],
    'SOLVÆR': []
  });
  const [runs, setRuns] = useState<Record<AgentId, AgentRunRecord[]>>({ TEAM: [], AUREN: [], 'VÆLON': [], 'SOLVÆR': [] });
  const [reviewedId, setReviewedId] = useState<string | null>(null);
  const lastRecord = runs[agent].find(record => record.id === reviewedId) ?? runs[agent].at(-1);
  const lastRun = lastRecord?.response ?? null;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const requestRef = useRef<{agent: AgentId; prompt: string; context: AgentSpatialContext; startedAt: string} | null>(null);
  const retain = (record: AgentRunRecord) => {
    setRuns(current => ({...current, [record.agent]: appendAgentRun(current[record.agent], record)}));
    setReviewedId(record.id);
  };
  const stopWaiting = () => {
    const request = requestRef.current;
    controllerRef.current?.abort(); controllerRef.current = null; requestRef.current = null;
    if (request) retain(createAgentUnfinishedRecord(request.agent, request.prompt, request.context, 'stopped', 'Stopped waiting locally. The backend may still finish this request; no server cancellation endpoint is available.', request.startedAt, new Date().toISOString()));
    setRunning(false);
  };

  useEffect(() => {
    if (!handoff) return;
    stopWaiting();
    setReviewedId(null);
    setAgent(handoff.agent);
    setDraft(handoff.prompt);
    setError(null);
    globalThis.setTimeout(() => textareaRef.current?.focus(), 0);
  }, [handoff?.id]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const history = histories[agent];
  const visibleHistory = useMemo(() => history.slice(-6), [history]);

  const submit = async () => {
    const message = draft.trim();
    if (!message || running) return;

    const before = histories[agent];
    const startedAt = new Date().toISOString();
    const requestedContext = structuredClone(context);
    const withUser = [...before, { role: 'user' as const, content: message }].slice(-16);
    setHistories((current) => ({ ...current, [agent]: withUser }));
    setDraft('');
    setError(null);
    setRunning(true);

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    requestRef.current = {agent, prompt: message, context: requestedContext, startedAt};
    setReviewedId(null);

    try {
      const result = await runAgent(agent, message, requestedContext, before, controller.signal);
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      const record = createAgentRunRecord(agent, message, requestedContext, result, startedAt, new Date().toISOString());
      retain(record);
      setHistories((current) => ({
        ...current,
        [agent]: [
          ...current[agent],
          { role: 'assistant' as const, content: result.reply }
        ].slice(-16)
      }));
    } catch (runError) {
      if (controller.signal.aborted) return;
      if (controllerRef.current !== controller) return;
      const messageText = runError instanceof Error ? runError.message : String(runError);
      retain(createAgentUnfinishedRecord(agent, message, requestedContext, 'failed', messageText, startedAt, new Date().toISOString()));
      setError(messageText);
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        requestRef.current = null;
        setRunning(false);
      }
    }
  };

  return (
    <section className="agent-dock">
      <div className="agent-dock-head">
        <span>
          <small>SPATIAL AI</small>
          <strong>{agent}</strong>
        </span>
        <em>ADVISORY ONLY</em>
      </div>

      <div className="agent-identities" aria-label="Specialist identities">
        {(['AUREN', 'VÆLON', 'SOLVÆR'] as const).map((id) => (
          <button type="button" key={id} aria-pressed={agent === id} disabled={running}
            onClick={() => { setAgent(id); setReviewedId(null); setError(null); }}>
            <img src={BRAND[id]} alt={`${id} mark`} />
            <strong>{id}</strong>
          </button>
        ))}
      </div>
      <p className="agent-role">{AGENT_ROLES[agent]}</p>
      <span className="agent-run-state" role="status">
        {running ? 'RUNNING' : lastRecord?.status === 'failed' ? 'FAILED' : lastRecord?.status === 'stopped' ? 'STOPPED WAITING' : lastRun ? agentResponseState(lastRun) : 'READY TO REQUEST · PROVIDER NOT YET VERIFIED'}
      </span>

      <div className="agent-tabs" role="group" aria-label="ÆTHERGRID agents">
        {AGENTS.map((id) => (
          <button
            key={id}
            type="button"
            className={agent === id ? 'active' : ''}
            disabled={running}
            aria-pressed={agent === id}
            onClick={() => {
              setAgent(id);
              setReviewedId(null);
              setError(null);
            }}
          >
            {id}
          </button>
        ))}
      </div>
      <AgentModelPanel agent={agent} active={active} />
      <p className="agent-request-context">Request context · {context.region} · {context.temporalMode.toUpperCase()} · {context.temporalCursor}
        {context.selectedEntity?.id ? ` · Entity ${String(context.selectedEntity.id)}` : ' · No selected entity'}</p>

      <ol className="agent-investigation-steps" aria-label="Investigation steps">
        <li>Inspect the selected spatial context</li><li>Request specialist analysis</li><li>Compare scenarios in the workspace</li><li>Review returned evidence</li>
      </ol>
      <div className="agent-thread" aria-live="polite">
        {visibleHistory.length ? (
          visibleHistory.map((item, index) => (
            <div className={`agent-message ${item.role}`} key={`${item.role}-${index}`}>
              <small>{item.role === 'user' ? 'OPERATOR' : agent}</small>
              <p>{item.content}</p>
            </div>
          ))
        ) : (
          <p className="agent-empty">
            Ask about the active city, selected entity, weather, infrastructure or scenario context.
          </p>
        )}
      </div>

      {lastRun ? (
        <div className="agent-runtime">
          <span>{lastRun.runtime.provider}</span>
          <span>{lastRun.runtime.model || 'MODEL NOT PROVIDED'}</span>
          <span>{lastRun.runtime.latencyMs} ms</span>
          <span className={agentResponseState(lastRun) === 'LOCAL FALLBACK' ? 'fallback' : agentResponseState(lastRun) === 'PROVIDER RESPONSE' ? 'verified' : 'unknown'}>
            {agentResponseState(lastRun)}
          </span>
          <code>{lastRun.receipt || 'NO RECEIPT'}</code>
          {lastRun.toolResults?.map((tool)=><p key={tool.tool}>{tool.tool} · read only · {tool.count} observations</p>)}
          {lastRun.citations?.map((citation)=><p key={citation.receipt}><a href={citation.href} target="_blank" rel="noreferrer">{citation.kind} · {citation.observedAt}</a><code>{citation.receipt}</code></p>)}
        </div>
      ) : null}
      {lastRecord ? <>
        <p className="agent-provenance">Backend request · {lastRecord.endpoint} · {lastRecord.status === 'completed' ? 'Completed' : 'Waiting ended'} {lastRecord.completedAt}. Execution receipts identify a request; they do not verify its factual claims. Attached citations reference recorded server observations; missing citations mean the response has no recorded provider grounding.</p>
        <article className="agent-reviewed-task" aria-label="Reviewed specialist task">
          <strong>{lastRecord.prompt}</strong>
          <small>{lastRecord.context.region} · {lastRecord.context.temporalMode.toUpperCase()} · {lastRecord.context.temporalCursor} · {lastRecord.context.selectedEntityId ?? 'No selected entity'} · {lastRecord.context.sourceFeatureId ?? 'No source feature ID'}</small>
          <p>{lastRun?.reply ?? lastRecord.error}</p>
          <small>Captured request context. Scenario comparisons use the current workspace.</small>
        </article>
        <details className="agent-task-history"><summary>Task history · {agent} · {runs[agent].length} retained</summary>
          <small>Eight local tasks per specialist; cleared when the application reloads.</small>
          {runs[agent].slice().reverse().map(record => <article key={record.id}>
            <strong>{record.prompt}</strong><small>{record.context.region} · {record.context.temporalMode.toUpperCase()} · {record.context.temporalCursor} · {record.context.selectedEntityId ?? 'No selected entity'}</small>
            <small>{record.startedAt} → {record.completedAt} · {record.response ? agentResponseState(record.response) : record.status === 'stopped' ? 'STOPPED WAITING' : 'FAILED'}{record.response ? ` · ${record.response.runtime.provider} · ${record.response.runtime.model ?? 'MODEL NOT PROVIDED'}` : ''}</small>
            <p>{record.response?.reply ?? record.error}</p><code>{record.response?.receipt || 'NO RECEIPT'}</code>
            <button type="button" aria-label={`Review task: ${record.prompt}`} aria-pressed={lastRecord.id === record.id} disabled={running} onClick={() => {setReviewedId(record.id);setError(null);}}>REVIEW TASK</button>
          </article>)}
        </details>
        <div className="agent-investigation-actions">
          {lastRun && onComparison ? <button type="button" onClick={onComparison}>COMPARE SCENARIOS</button> : null}
          {lastRun?.evidence?.id && onEvidence ? <button type="button" onClick={() => onEvidence(lastRun.evidence!.id!)}>REVIEW EVIDENCE</button> : null}
        </div>
      </> : null}

      {error ? <div className="agent-error">{error}</div> : null}

      {lastRun?.contributions?.length ? (
        <details className="agent-contributions">
          <summary>Specialist contributions · {lastRun.contributions.length}</summary>
          {lastRun.contributions.map((contribution) => (
            <article key={`${contribution.agent}:${contribution.receipt}`}>
              <strong>{contribution.agent}</strong>
              <small>{contribution.runtime.provider} · {contribution.runtime.model ?? 'MODEL NOT PROVIDED'} · {agentResponseState({runtime:contribution.runtime})}</small>
              <p>{contribution.reply}</p>
              <code>{contribution.receipt || 'NO RECEIPT'}</code>
            </article>
          ))}
        </details>
      ) : null}
      {lastRun?.evidence?.id ? (
        <p className="agent-evidence">Evidence · {lastRun.evidence.title ?? lastRun.evidence.id} · {lastRun.evidence.status ?? 'Recorded'}</p>
      ) : null}

      <form
        className="agent-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          rows={2}
          aria-label={`Message ${agent}`}
          placeholder={`Ask ${agent} about this spatial context…`}
          onChange={(event) => setDraft(event.currentTarget.value)}
          disabled={running}
        />
        <button type="submit" disabled={running || !draft.trim()}>
          {running ? 'ANALYZING…' : 'SEND'}
        </button>
      </form>
      {running ? <button type="button" onClick={stopWaiting}>STOP WAITING</button> : null}
    </section>
  );
}
