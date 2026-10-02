import { useEffect, useMemo, useRef, useState } from 'react';

import {
  runAgent,
  type AgentHistoryItem,
  type AgentId,
  type AgentResponse,
  type AgentSpatialContext
} from '../services/agent-client';

const AGENTS: readonly AgentId[] = ['TEAM', 'AUREN', 'VÆLON', 'SOLVÆR'];

export interface AgentHandoffRequest {
  id: number;
  agent: AgentId;
  prompt: string;
}

interface AgentDockProps {
  context: AgentSpatialContext;
  handoff?: AgentHandoffRequest | null;
}

export function AgentDock({ context, handoff = null }: AgentDockProps) {
  const [agent, setAgent] = useState<AgentId>('TEAM');
  const [draft, setDraft] = useState('');
  const [histories, setHistories] = useState<Record<AgentId, AgentHistoryItem[]>>({
    TEAM: [],
    AUREN: [],
    'VÆLON': [],
    'SOLVÆR': []
  });
  const [lastRun, setLastRun] = useState<AgentResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!handoff) return;
    setAgent(handoff.agent);
    setDraft(handoff.prompt);
    setLastRun(null);
    setError(null);
    globalThis.setTimeout(() => textareaRef.current?.focus(), 0);
  }, [handoff?.id]);

  const history = histories[agent];
  const visibleHistory = useMemo(() => history.slice(-6), [history]);

  const submit = async () => {
    const message = draft.trim();
    if (!message || running) return;

    const before = histories[agent];
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
      setLastRun(result);
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
      if (controllerRef.current === controller) controllerRef.current = null;
      setRunning(false);
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

      <div className="agent-tabs" role="tablist" aria-label="ÆTHERGRID agents">
        {AGENTS.map((id) => (
          <button
            key={id}
            type="button"
            className={agent === id ? 'active' : ''}
            onClick={() => {
              setAgent(id);
              setLastRun(null);
              setError(null);
            }}
          >
            {id}
          </button>
        ))}
      </div>

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
          <span>{lastRun.runtime.model || 'fallback'}</span>
          <span>{lastRun.runtime.latencyMs} ms</span>
          <span className={lastRun.runtime.fallbackUsed ? 'fallback' : 'verified'}>
            {lastRun.runtime.fallbackUsed ? 'FALLBACK' : 'PROVIDER'}
          </span>
          <code>{lastRun.receipt ? lastRun.receipt.slice(0, 12) : 'NO RECEIPT'}</code>
        </div>
      ) : null}

      {error ? <div className="agent-error">{error}</div> : null}

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
          placeholder={`Ask ${agent} about this spatial context…`}
          onChange={(event) => setDraft(event.currentTarget.value)}
          disabled={running}
        />
        <button type="submit" disabled={running || !draft.trim()}>
          {running ? 'ANALYZING…' : 'SEND'}
        </button>
      </form>
    </section>
  );
}
