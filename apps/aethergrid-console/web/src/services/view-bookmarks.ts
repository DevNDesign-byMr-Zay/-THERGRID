import type {
  LayerState,
  SpatialTarget,
  SpatialScenarioVisual,
  TemporalMode,
  VisualMode
} from '../renderer/spatial-renderer';
import type { UseCaseId } from '../app/use-case-presets';
import type { TimeRange } from '../time/temporal-model';

export interface SpatialViewBookmark {
  id: string;
  name: string;
  createdAt: string;
  scope: 'world' | 'city';
  target: SpatialTarget & {
    id?: string;
    name?: string;
    district?: string;
    custom?: boolean;
  };
  visualMode: VisualMode;
  temporalMode: TemporalMode;
  cursorIso: string;
  playbackRange?: TimeRange | null;
  scenarioId?: string | null;
  scenarioVisual?: SpatialScenarioVisual | null;
  useCase: UseCaseId | null;
  layers: readonly LayerState[];
}

const STORAGE_KEY = 'aethergrid.operator.spatial-bookmarks.v4';
const MAX_BOOKMARKS = 12;

function validBookmark(value: unknown): value is SpatialViewBookmark {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SpatialViewBookmark>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    (item.scope === 'world' || item.scope === 'city') &&
    typeof item.target?.latitude === 'number' &&
    typeof item.target?.longitude === 'number' &&
    typeof item.cursorIso === 'string' &&
    typeof item.visualMode === 'string' &&
    Array.isArray(item.layers) &&
    (item.playbackRange == null || (typeof item.playbackRange.start === 'string' && typeof item.playbackRange.end === 'string' &&
      Number.isFinite(Date.parse(item.playbackRange.start)) && Number.isFinite(Date.parse(item.playbackRange.end)) &&
      Date.parse(item.playbackRange.end) >= Date.parse(item.playbackRange.start)))
  );
}

export function loadSpatialBookmarks(): SpatialViewBookmark[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validBookmark).slice(0, MAX_BOOKMARKS);
  } catch {
    return [];
  }
}

export function saveSpatialBookmarks(
  bookmarks: readonly SpatialViewBookmark[]
): SpatialViewBookmark[] {
  const next = bookmarks.slice(0, MAX_BOOKMARKS).map((bookmark) => ({
    ...bookmark,
    target: { ...bookmark.target },
    playbackRange: bookmark.playbackRange ? { ...bookmark.playbackRange } : null,
    layers: bookmark.layers.map((layer) => ({ ...layer }))
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function createSpatialBookmark(
  input: Omit<SpatialViewBookmark, 'id' | 'createdAt'>
): SpatialViewBookmark {
  const createdAt = new Date().toISOString();
  return {
    ...input,
    id: `view-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    target: { ...input.target },
    playbackRange: input.playbackRange ? { ...input.playbackRange } : null,
    layers: input.layers.map((layer) => ({ ...layer }))
  };
}
