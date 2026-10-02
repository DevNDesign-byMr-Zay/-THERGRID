import { useEffect, useMemo, useState } from 'react';

import {
  createOperatorSession,
  downloadOperatorSession,
  loadOperatorSessions,
  MAX_OPERATOR_SESSIONS,
  removeOperatorSession,
  saveOperatorSessions,
  type OperatorSessionWorkspace,
  type OperatorWorkspaceSession
} from '../services/operator-session';
import {
  loadSpatialWorkset,
  SPATIAL_WORKSET_EVENT,
  type SpatialWorksetItem
} from '../services/spatial-workset';

interface OperatorSessionPanelProps {
  current: Omit<OperatorSessionWorkspace, 'workset'>;
  onRestore(session: OperatorWorkspaceSession): void;
}

function formatSessionTime(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value;
}

export function OperatorSessionPanel({
  current,
  onRestore
}: OperatorSessionPanelProps) {
  const [sessions, setSessions] =
    useState<OperatorWorkspaceSession[]>(loadOperatorSessions);
  const [name, setName] = useState('');
  const [workset, setWorkset] =
    useState<SpatialWorksetItem[]>(loadSpatialWorkset);

  useEffect(() => {
    const sync = () => setWorkset(loadSpatialWorkset());
    globalThis.addEventListener?.(SPATIAL_WORKSET_EVENT, sync);
    return () => globalThis.removeEventListener?.(SPATIAL_WORKSET_EVENT, sync);
  }, []);

  const activeSummary = useMemo(
    () => ({
      workset: workset.length,
      incidents: current.incidents.length,
      comparisons:
        Number(Boolean(current.observationA)) + Number(Boolean(current.observationB))
    }),
    [current, workset]
  );

  const save = () => {
    const session = createOperatorSession(name, { ...current, workset });
    const next = saveOperatorSessions([
      session,
      ...sessions.filter((candidate) => candidate.name !== session.name)
    ]);
    setSessions(next);
    setName('');
  };

  const remove = (id: string) => {
    setSessions(removeOperatorSession(sessions, id));
  };

  return (
    <section className="operator-session-panel">
      <div className="operator-session-head">
        <span>
          <small>OPERATOR SESSIONS</small>
          <strong>
            {sessions.length}/{MAX_OPERATOR_SESSIONS} SAVED
          </strong>
        </span>
        <em>LOCAL</em>
      </div>

      <div className="operator-session-current">
        <span>
          <small>WORKSET</small>
          <strong>{activeSummary.workset}</strong>
        </span>
        <span>
          <small>INCIDENTS</small>
          <strong>{activeSummary.incidents}</strong>
        </span>
        <span>
          <small>A/B FRAMES</small>
          <strong>{activeSummary.comparisons}</strong>
        </span>
      </div>

      <div className="operator-session-compose">
        <input
          value={name}
          maxLength={80}
          placeholder="Name current workspace"
          aria-label="Operator session name"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <button type="button" onClick={save}>
          SAVE SESSION
        </button>
      </div>

      {sessions.length ? (
        <div className="operator-session-list">
          {sessions.map((session) => {
            const workspace = session.workspace;
            return (
              <article key={session.id}>
                <header>
                  <span>
                    <small>
                      {workspace.view.scope.toUpperCase()} ·{' '}
                      {workspace.view.temporalMode.toUpperCase()}
                    </small>
                    <strong>{session.name}</strong>
                  </span>
                  <em>{formatSessionTime(session.updatedAt)}</em>
                </header>

                <p>
                  {workspace.view.target.name ??
                    workspace.view.target.id ??
                    'Spatial workspace'}{' '}
                  · {workspace.view.visualMode.toUpperCase()}
                </p>

                <div className="operator-session-tags">
                  <span>{workspace.workset.length} WORKSET</span>
                  <span>{workspace.incidents.length} INCIDENTS</span>
                  <span>
                    {Number(Boolean(workspace.observationA)) +
                      Number(Boolean(workspace.observationB))}{' '}
                    A/B
                  </span>
                  <span>
                    {workspace.frozenDossier ? 'DOSSIER' : 'NO DOSSIER'}
                  </span>
                </div>

                <div className="operator-session-actions">
                  <button type="button" onClick={() => onRestore(session)}>
                    RESTORE
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadOperatorSession(session)}
                  >
                    EXPORT
                  </button>
                  <button type="button" onClick={() => remove(session.id)}>
                    REMOVE
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="operator-session-empty">No saved operator sessions.</p>
      )}

      <div className="analysis-boundary operator-session-boundary">
        <strong>WORKSPACE SNAPSHOT · NON-AUTHORITATIVE</strong>
        <span>
          Restore never reselects a source entity. LIVE sessions resume at
          current live time, while saved historical/forecast/scenario cursors
          return only as operator context and must be revalidated against
          current source state.
        </span>
      </div>
    </section>
  );
}
