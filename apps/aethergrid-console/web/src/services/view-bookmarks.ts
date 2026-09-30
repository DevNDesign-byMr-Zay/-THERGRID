import type {
  LayerState,
  SpatialTarget,
  TemporalMode,
  VisualMode
} from '../renderer/spatial-renderer';
import type { UseCaseId } from '../app/use-case-presets';

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
  scenarioId?: string | null;
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
    typeof item.visualMode === 'string' &&
    Array.isArray(item.layers)
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
    layers: input.layers.map((layer) => ({ ...layer }))
  };
}
