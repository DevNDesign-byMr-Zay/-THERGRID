import { useEffect, useMemo, useRef, useState } from 'react';
import { AGENT_ROLES, BRAND } from './brand';

import {
  runAgent,
  type AgentHistoryItem,
  type AgentId,
  type AgentSpatialContext
} from '../services/agent-client';
import { agentResponseState, appendAgentRun, createAgentRunRecord, type AgentRunRecord } from '../services/agent-run-history';

const AGENTS: readonly AgentId[] = ['TEAM', 'AUREN', 'VÆLON', 'SOLVÆR'];

export interface AgentHandoffRequest {
  id: number;
  agent: AgentId;
  prompt: string;
}

interface AgentDockProps {
  context: AgentSpatialContext;
  handoff?: AgentHandoffRequest | null;
  onEvidence?(id: string): void;
  onComparison?(): void;
}

export function AgentDock({ context, handoff = null, onEvidence, onComparison }: AgentDockProps) {
  const [agent, setAgent] = useState<AgentId>('TEAM');
  const [draft, setDraft] = useState('');
  const [histories, setHistories] = useState<Record<AgentId, AgentHistoryItem[]>>({
    TEAM: [],
    AUREN: [],
    'VÆLON': [],
    'SOLVÆR': []
  });
  const [runs, setRuns] = useState<Record<AgentId, AgentRunRecord[]>>({ TEAM: [], AUREN: [], 'VÆLON': [], 'SOLVÆR': [] });
  const lastRecord = runs[agent].at(-1);
  const lastRun = lastRecord?.response ?? null;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!handoff) return;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
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

    try {
      const result = await runAgent(agent, message, context, before, controller.signal);
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      const record = createAgentRunRecord(agent, message, requestedContext, result, startedAt, new Date().toISOString());
      setRuns(current => ({ ...current, [agent]: appendAgentRun(current[agent], record) }));
      setHistories((current) => ({
        ...current,
        [agent]: [
          ...current[agent],
          { role: 'assistant' as const, content: result.reply }
        ].slice(-16)
      }));
    } catch (runError) {
      if (controller.signal.aborted) return;
      setError(runError instanceof Error ? runError.message : String(runError));
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
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
            onClick={() => { setAgent(id); setError(null); }}>
            <img src={BRAND[id]} alt={`${id} mark`} />
            <strong>{id}</strong>
          </button>
        ))}
      </div>
      <p className="agent-role">{AGENT_ROLES[agent]}</p>
      <span className="agent-run-state" role="status">
        {running ? 'RUNNING' : lastRun ? agentResponseState(lastRun) : 'READY TO REQUEST · PROVIDER NOT YET VERIFIED'}
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
              setError(null);
            }}
          >
            {id}
          </button>
        ))}
      </div>
      <p className="agent-request-context">Request context · {context.region} · {context.temporalMode.toUpperCase()} · {context.temporalCursor}
        {context.selectedEntity?.id ? ` · Entity ${String(context.selectedEntity.id)}` : ' · No selected entity'}</p>

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
          <span className={lastRun.runtime.fallbackUsed ? 'fallback' : agentResponseState(lastRun) === 'PROVIDER RESPONSE' ? 'verified' : 'unknown'}>
            {agentResponseState(lastRun)}
          </span>
          <code>{lastRun.receipt || 'NO RECEIPT'}</code>
        </div>
      ) : null}
      {lastRecord ? <>
        <p className="agent-provenance">Backend request · {lastRecord.endpoint} · Completed {lastRecord.completedAt}. Execution receipts identify a request; they do not verify its factual claims. Tool-call provenance and citations are unavailable in the published API.</p>
        <details className="agent-task-history"><summary>Task history · {agent} · {runs[agent].length} retained</summary>
          {runs[agent].slice().reverse().map(record => <article key={record.id}>
            <strong>{record.prompt}</strong><small>{record.context.region} · {record.context.temporalMode.toUpperCase()} · {record.context.temporalCursor} · {record.context.selectedEntityId ?? 'No selected entity'}</small>
            <small>{record.startedAt} → {record.completedAt} · {agentResponseState(record.response)} · {record.response.runtime.provider} · {record.response.runtime.model ?? 'MODEL NOT PROVIDED'}</small>
            <p>{record.response.reply}</p><code>{record.response.receipt || 'NO RECEIPT'}</code>
          </article>)}
        </details>
        <div className="agent-investigation-actions">
          {onComparison ? <button type="button" onClick={onComparison}>COMPARE SCENARIOS</button> : null}
          {lastRun?.evidence?.id && onEvidence ? <button type="button" onClick={() => onEvidence(lastRun.evidence!.id!)}>REVIEW EVIDENCE</button> : null}
        </div>
      </> : null}

      {error ? <div className="agent-error">{error}</div> : null}

      {lastRun?.contributions?.length ? (
        <details className="agent-contributions">
          <summary>Specialist contributions · {lastRun.contributions.length}</summary>
          {lastRun.contributions.map((contribution) => (
            <article key={contribution.agent}>
              <strong>{contribution.agent}</strong>
              <small>{contribution.runtime.provider} · {contribution.runtime.model ?? 'MODEL NOT PROVIDED'} · {contribution.runtime.fallbackUsed ? 'FALLBACK' : contribution.runtime.provider !== 'unknown' && contribution.runtime.model ? 'PROVIDER RESPONSE' : 'UNVERIFIED RESPONSE'}</small>
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
      {running ? <button type="button" onClick={() => { controllerRef.current?.abort(); controllerRef.current = null; setRunning(false); setError('Stopped waiting locally. The backend may still finish this request; no server cancellation endpoint is available.'); }}>STOP WAITING</button> : null}
    </section>
  );
}
