import type {
  SpatialInteractionMode,
  SpatialSurfacePoint,
  TemporalInstant
} from '../renderer/spatial-renderer';
import type { SpatialEntityDossier } from './spatial-entity-dossier';
import type { SpatialIncident } from './spatial-incidents';
import type { SpatialObservation } from './spatial-comparison';
import type { SpatialWorksetItem } from './spatial-workset';
import type { SpatialViewBookmark } from './view-bookmarks';

export type OperatorSessionView = Omit<
  SpatialViewBookmark,
  'id' | 'name' | 'createdAt'
>;

export interface OperatorSessionWorkspace {
  view: OperatorSessionView;
  interactionMode: SpatialInteractionMode;
  measurementPoints: readonly SpatialSurfacePoint[];
  measurementFrame: TemporalInstant | null;
  observationA: SpatialObservation | null;
  observationB: SpatialObservation | null;
  frozenDossier: SpatialEntityDossier | null;
  workset: readonly SpatialWorksetItem[];
  incidents: readonly SpatialIncident[];
}

export interface OperatorWorkspaceSession {
  schemaVersion: 'aethergrid.operator-workspace-session.v1';
  kind: 'operator-workspace-session';
  authoritative: false;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  restorePolicy: {
    activeSelectionRestored: false;
    liveTimePolicy: 'resume-current-live';
    sourceTruthPolicy: 'revalidate-after-restore';
  };
  workspace: OperatorSessionWorkspace;
}

export interface OperatorWorkspaceSessionExport {
  schemaVersion: 'aethergrid.operator-workspace-session-export.v1';
  kind: 'operator-workspace-session-export';
  authoritative: false;
  exportedAt: string;
  note: string;
  session: OperatorWorkspaceSession;
}

const STORAGE_KEY = 'aethergrid.operator.workspace-sessions.v4';
export const MAX_OPERATOR_SESSIONS = 8;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function boundedName(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
    .trim()
    .slice(0, 80);
}

function validSession(value: unknown): value is OperatorWorkspaceSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<OperatorWorkspaceSession>;
  const workspace = session.workspace as Partial<OperatorSessionWorkspace> | undefined;
  return (
    session.schemaVersion === 'aethergrid.operator-workspace-session.v1' &&
    session.kind === 'operator-workspace-session' &&
    session.authoritative === false &&
    typeof session.id === 'string' &&
    typeof session.name === 'string' &&
    typeof session.createdAt === 'string' &&
    typeof session.updatedAt === 'string' &&
    session.restorePolicy?.activeSelectionRestored === false &&
    session.restorePolicy?.liveTimePolicy === 'resume-current-live' &&
    session.restorePolicy?.sourceTruthPolicy === 'revalidate-after-restore' &&
    Boolean(workspace?.view) &&
    (workspace?.view?.scope === 'world' || workspace?.view?.scope === 'city') &&
    typeof workspace?.view?.target?.latitude === 'number' &&
    typeof workspace?.view?.target?.longitude === 'number' &&
    typeof workspace?.view?.cursorIso === 'string' &&
    Array.isArray(workspace?.view?.layers) &&
    Array.isArray(workspace?.measurementPoints) &&
    Array.isArray(workspace?.workset) &&
    Array.isArray(workspace?.incidents)
  );
}

export function loadOperatorSessions(): OperatorWorkspaceSession[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(validSession)
      .slice(0, MAX_OPERATOR_SESSIONS)
      .map((session) => clone(session));
  } catch {
    return [];
  }
}

export function saveOperatorSessions(
  sessions: readonly OperatorWorkspaceSession[]
): OperatorWorkspaceSession[] {
  const unique = sessions
    .filter(
      (session, index, candidates) =>
        candidates.findIndex((candidate) => candidate.id === session.id) === index
    )
    .slice(0, MAX_OPERATOR_SESSIONS)
    .map((session) => clone(session));

  localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  return unique;
}

export function createOperatorSession(
  name: string,
  workspace: OperatorSessionWorkspace
): OperatorWorkspaceSession {
  const now = new Date().toISOString();
  const safeName = boundedName(name) || 'Operator Session';
  return {
    schemaVersion: 'aethergrid.operator-workspace-session.v1',
    kind: 'operator-workspace-session',
    authoritative: false,
    id: `session:${now}:${Math.random().toString(36).slice(2, 8)}`,
    name: safeName,
    createdAt: now,
    updatedAt: now,
    restorePolicy: {
      activeSelectionRestored: false,
      liveTimePolicy: 'resume-current-live',
      sourceTruthPolicy: 'revalidate-after-restore'
    },
    workspace: clone(workspace)
  };
}

export function upsertOperatorSession(
  current: readonly OperatorWorkspaceSession[],
  session: OperatorWorkspaceSession
): OperatorWorkspaceSession[] {
  const next = [
    clone(session),
    ...current.filter((candidate) => candidate.id !== session.id)
  ];
  return saveOperatorSessions(next);
}

export function removeOperatorSession(
  current: readonly OperatorWorkspaceSession[],
  id: string
): OperatorWorkspaceSession[] {
  return saveOperatorSessions(
    current.filter((session) => session.id !== id)
  );
}

export function clearOperatorSessions(): OperatorWorkspaceSession[] {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}

export function buildOperatorSessionExport(
  session: OperatorWorkspaceSession
): OperatorWorkspaceSessionExport {
  return {
    schemaVersion: 'aethergrid.operator-workspace-session-export.v1',
    kind: 'operator-workspace-session-export',
    authoritative: false,
    exportedAt: new Date().toISOString(),
    note:
      'Local operator workspace snapshot. Restoring it does not reselect or revalidate any source entity, does not prove source freshness, and resumes current time for sessions saved in LIVE mode.',
    session: clone(session)
  };
}

export function downloadOperatorSession(
  session: OperatorWorkspaceSession
): void {
  const payload = buildOperatorSessionExport(session);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aethergrid-operator-session-${session.name
    .replace(/[^a-z0-9._-]+/giu, '-')
    .slice(0, 60)}-${payload.exportedAt
    .replaceAll(':', '-')
    .replaceAll('.', '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
