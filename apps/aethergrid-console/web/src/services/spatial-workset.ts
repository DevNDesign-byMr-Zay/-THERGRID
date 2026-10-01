import {
  freezeSpatialEntityDossier,
  type SpatialEntityDossier
} from './spatial-entity-dossier';

export interface SpatialWorksetItem {
  id: string;
  canonicalId: string;
  pinnedAt: string;
  dossier: SpatialEntityDossier;
}

export interface SpatialWorksetExport {
  schemaVersion: 'aethergrid.operator-spatial-workset.v1';
  kind: 'operator-spatial-workset';
  authoritative: false;
  generatedAt: string;
  itemCount: number;
  note: string;
  items: readonly SpatialWorksetItem[];
}

const STORAGE_KEY = 'aethergrid.operator.spatial-workset.v4';
export const MAX_SPATIAL_WORKSET_ITEMS = 12;

function validDossier(value: unknown): value is SpatialEntityDossier {
  if (!value || typeof value !== 'object') return false;
  const dossier = value as Partial<SpatialEntityDossier>;
  return (
    dossier.schemaVersion === 'aethergrid.operator-entity-dossier.v1' &&
    dossier.kind === 'operator-entity-dossier' &&
    dossier.authoritative === false &&
    typeof dossier.generatedAt === 'string' &&
    typeof dossier.region === 'string' &&
    typeof dossier.entity?.canonicalId === 'string' &&
    typeof dossier.entity?.displayName === 'string' &&
    typeof dossier.temporal?.iso === 'string' &&
    dossier.frozen === true
  );
}

function validItem(value: unknown): value is SpatialWorksetItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SpatialWorksetItem>;
  return (
    typeof item.id === 'string' &&
    typeof item.canonicalId === 'string' &&
    typeof item.pinnedAt === 'string' &&
    validDossier(item.dossier)
  );
}

function cloneItem(item: SpatialWorksetItem): SpatialWorksetItem {
  return {
    id: item.id,
    canonicalId: item.canonicalId,
    pinnedAt: item.pinnedAt,
    dossier: freezeSpatialEntityDossier(item.dossier)
  };
}

export function loadSpatialWorkset(): SpatialWorksetItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(validItem)
      .filter(
        (item, index, items) =>
          items.findIndex(
            (candidate) => candidate.canonicalId === item.canonicalId
          ) === index
      )
      .slice(0, MAX_SPATIAL_WORKSET_ITEMS)
      .map(cloneItem);
  } catch {
    return [];
  }
}

export function saveSpatialWorkset(
  items: readonly SpatialWorksetItem[]
): SpatialWorksetItem[] {
  const unique = items
    .filter(
      (item, index, candidates) =>
        candidates.findIndex(
          (candidate) => candidate.canonicalId === item.canonicalId
        ) === index
    )
    .slice(0, MAX_SPATIAL_WORKSET_ITEMS)
    .map(cloneItem);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  return unique;
}

export function pinSpatialEntityDossier(
  current: readonly SpatialWorksetItem[],
  dossier: SpatialEntityDossier
): SpatialWorksetItem[] {
  const frozen = freezeSpatialEntityDossier(dossier);
  const pinnedAt = new Date().toISOString();
  const item: SpatialWorksetItem = {
    id: `workset:${frozen.entity.canonicalId}`,
    canonicalId: frozen.entity.canonicalId,
    pinnedAt,
    dossier: frozen
  };

  return saveSpatialWorkset([
    item,
    ...current.filter(
      (candidate) => candidate.canonicalId !== frozen.entity.canonicalId
    )
  ]);
}

export function removeSpatialWorksetItem(
  current: readonly SpatialWorksetItem[],
  canonicalId: string
): SpatialWorksetItem[] {
  return saveSpatialWorkset(
    current.filter((item) => item.canonicalId !== canonicalId)
  );
}

export function clearSpatialWorkset(): SpatialWorksetItem[] {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}

export function buildSpatialWorksetExport(
  items: readonly SpatialWorksetItem[]
): SpatialWorksetExport {
  return {
    schemaVersion: 'aethergrid.operator-spatial-workset.v1',
    kind: 'operator-spatial-workset',
    authoritative: false,
    generatedAt: new Date().toISOString(),
    itemCount: Math.min(items.length, MAX_SPATIAL_WORKSET_ITEMS),
    note:
      'Local operator workset of frozen non-authoritative entity dossiers. Coordinates are navigation anchors only; restoring a coordinate does not prove that the original entity has been reselected.',
    items: Object.freeze(
      items
        .slice(0, MAX_SPATIAL_WORKSET_ITEMS)
        .map((item) => cloneItem(item))
    )
  };
}

export function downloadSpatialWorkset(
  items: readonly SpatialWorksetItem[]
): void {
  const payload = buildSpatialWorksetExport(items);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aethergrid-spatial-workset-${payload.generatedAt
    .replaceAll(':', '-')
    .replaceAll('.', '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
