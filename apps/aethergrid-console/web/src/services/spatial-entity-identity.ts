import type {
  SpatialEntityIdentity,
  SpatialFeatureSelection
} from '../renderer/spatial-renderer';

const GERS_KEYS = ['gersId', 'gers_id', 'overtureGersId', 'overture_gers_id'] as const;
const OSM_KEYS = ['osmId', 'osm_id', '@id', 'elementId', 'element_id'] as const;
const SOURCE_FEATURE_KEYS = [
  'sourceFeatureId',
  'sourceLineId',
  'sourceBuildingId',
  'sourceNodeId',
  'sourceAreaId',
  'sourceRoadId',
  'sourceWaterId'
] as const;
const DISPLAY_NAME_KEYS = ['name', 'label', 'title', 'headline'] as const;

function propertyString(
  properties: Readonly<Record<string, unknown>> | undefined,
  keys: readonly string[]
): string | null {
  if (!properties) return null;
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function namespace(value: string | null | undefined): string {
  const normalized = String(value ?? 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return normalized || 'unknown';
}

function scopedSceneId(
  selection: SpatialFeatureSelection,
  scopeId: string
): string {
  return [
    'scene',
    namespace(scopeId),
    namespace(selection.source),
    namespace(selection.kind),
    namespace(selection.id)
  ].join(':');
}

export function resolveSpatialEntityIdentity(
  selection: SpatialFeatureSelection,
  scopeId = 'global'
): SpatialEntityIdentity {
  const properties = selection.properties;
  const gersId = propertyString(properties, GERS_KEYS);
  const osmId = propertyString(properties, OSM_KEYS);
  const sourceFeatureId =
    propertyString(properties, SOURCE_FEATURE_KEYS) ??
    (selection.source === 'aethergrid-spatial-overlay' ? selection.id : null);
  const layerId = propertyString(properties, ['layerId']);
  const displayName =
    propertyString(properties, DISPLAY_NAME_KEYS) ??
    propertyString(properties, ['sourceName']) ??
    selection.id;

  if (gersId) {
    return Object.freeze({
      canonicalId: `gers:${gersId}`,
      sceneId: selection.id,
      sourceId: gersId,
      sourceFeatureId,
      displayName,
      kind: selection.kind,
      source: selection.source ?? null,
      layerId,
      basis: 'gers',
      gersId,
      osmId,
      crossSourceJoinReady: true
    });
  }

  if (osmId) {
    return Object.freeze({
      canonicalId: `osm:${osmId}`,
      sceneId: selection.id,
      sourceId: osmId,
      sourceFeatureId: sourceFeatureId ?? osmId,
      displayName,
      kind: selection.kind,
      source: selection.source ?? null,
      layerId,
      basis: 'source-native',
      gersId: null,
      osmId,
      crossSourceJoinReady: false
    });
  }

  if (sourceFeatureId) {
    return Object.freeze({
      canonicalId: `source:${namespace(selection.source)}:${sourceFeatureId}`,
      sceneId: selection.id,
      sourceId: sourceFeatureId,
      sourceFeatureId,
      displayName,
      kind: selection.kind,
      source: selection.source ?? null,
      layerId,
      basis:
        selection.source === 'aethergrid-spatial-overlay'
          ? 'overlay-stable'
          : 'source-native',
      gersId: null,
      osmId: null,
      crossSourceJoinReady: false
    });
  }

  return Object.freeze({
    canonicalId: scopedSceneId(selection, scopeId),
    sceneId: selection.id,
    sourceId: selection.id,
    sourceFeatureId: null,
    displayName,
    kind: selection.kind,
    source: selection.source ?? null,
    layerId,
    basis: 'scene-derived',
    gersId: null,
    osmId: null,
    crossSourceJoinReady: false
  });
}

export function bindSpatialSelectionIdentity(
  selection: SpatialFeatureSelection,
  scopeId = 'global'
): SpatialFeatureSelection {
  return Object.freeze({
    ...selection,
    identity: resolveSpatialEntityIdentity(selection, scopeId)
  });
}

export function sameCanonicalEntity(
  a: SpatialFeatureSelection | null | undefined,
  b: SpatialFeatureSelection | null | undefined
): boolean | null {
  const aId = a?.identity?.canonicalId;
  const bId = b?.identity?.canonicalId;
  if (!aId || !bId) return null;
  return aId === bId;
}
