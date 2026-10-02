import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';
import type { TemporalInstant } from '../renderer/spatial-renderer';
import type { SpatialEntityDossier } from './spatial-entity-dossier';
import { loadSpatialWorkset } from './spatial-workset';

export type SpatialIncidentSeverity =
  | 'info'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type SpatialIncidentStatus =
  | 'open'
  | 'monitoring'
  | 'resolved'
  | 'dismissed';

export type SpatialIncidentCategory =
  | 'note'
  | 'incident'
  | 'risk'
  | 'maintenance'
  | 'infrastructure'
  | 'environment';

export interface SpatialIncidentAnchor {
  latitude: number;
  longitude: number;
  heightMeters: number | null;
  region: string;
  canonicalId: string | null;
  sceneId: string | null;
  sourceFeatureId: string | null;
  identityBasis: string | null;
  gersId: string | null;
}

export interface SpatialIncident {
  schemaVersion: 'aethergrid.operator-spatial-incident.v1';
  id: string;
  authoritative: false;
  operatorGenerated: true;
  title: string;
  note: string;
  category: SpatialIncidentCategory;
  severity: SpatialIncidentSeverity;
  status: SpatialIncidentStatus;
  createdAt: string;
  updatedAt: string;
  observedAt: string;
  resolvedAt: string | null;
  temporalMode: TemporalInstant['mode'];
  sourceTime: string | null;
  scenarioId: string | null;
  anchor: SpatialIncidentAnchor;
  linkedWorksetCanonicalId: string | null;
}

export interface SpatialIncidentCreateInput {
  title: string;
  note?: string;
  category: SpatialIncidentCategory;
  severity: SpatialIncidentSeverity;
  temporal: TemporalInstant;
  region: string;
  dossier?: SpatialEntityDossier | null;
  coordinate: {
    latitude: number;
    longitude: number;
    heightMeters?: number | null;
  };
}

export interface SpatialIncidentExport {
  schemaVersion: 'aethergrid.operator-spatial-incidents.v1';
  kind: 'operator-spatial-incidents';
  authoritative: false;
  generatedAt: string;
  incidentCount: number;
  note: string;
  incidents: readonly SpatialIncident[];
}

const STORAGE_KEY = 'aethergrid.operator.spatial-incidents.v4';
export const SPATIAL_INCIDENTS_EVENT = 'aethergrid:spatial-incidents-changed';
export const MAX_SPATIAL_INCIDENTS = 48;

const CATEGORIES = new Set<SpatialIncidentCategory>([
  'note',
  'incident',
  'risk',
  'maintenance',
  'infrastructure',
  'environment'
]);

const SEVERITIES = new Set<SpatialIncidentSeverity>([
  'info',
  'low',
  'medium',
  'high',
  'critical'
]);

const STATUSES = new Set<SpatialIncidentStatus>([
  'open',
  'monitoring',
  'resolved',
  'dismissed'
]);

function boundedText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
    .trim()
    .slice(0, maxLength);
}

function finiteCoordinate(value: unknown, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error('Spatial incident coordinate is invalid');
  }
  return number;
}

function incidentId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `incident:${uuid}`
    : `incident:${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
}

function validIncident(value: unknown): value is SpatialIncident {
  if (!value || typeof value !== 'object') return false;
  const incident = value as Partial<SpatialIncident>;
  return (
    incident.schemaVersion === 'aethergrid.operator-spatial-incident.v1' &&
    incident.authoritative === false &&
    incident.operatorGenerated === true &&
    typeof incident.id === 'string' &&
    typeof incident.title === 'string' &&
    typeof incident.note === 'string' &&
    CATEGORIES.has(incident.category as SpatialIncidentCategory) &&
    SEVERITIES.has(incident.severity as SpatialIncidentSeverity) &&
    STATUSES.has(incident.status as SpatialIncidentStatus) &&
    typeof incident.createdAt === 'string' &&
    typeof incident.updatedAt === 'string' &&
    typeof incident.observedAt === 'string' &&
    Boolean(incident.anchor) &&
    Number.isFinite(incident.anchor?.latitude) &&
    Number.isFinite(incident.anchor?.longitude)
  );
}

function cloneIncident(incident: SpatialIncident): SpatialIncident {
  return {
    ...incident,
    anchor: { ...incident.anchor }
  };
}

function notifyChanged(items: readonly SpatialIncident[]): void {
  globalThis.dispatchEvent?.(
    new CustomEvent(SPATIAL_INCIDENTS_EVENT, {
      detail: { count: items.length }
    })
  );
}

export function loadSpatialIncidents(): SpatialIncident[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(validIncident)
      .slice(0, MAX_SPATIAL_INCIDENTS)
      .map(cloneIncident);
  } catch {
    return [];
  }
}

export function saveSpatialIncidents(
  incidents: readonly SpatialIncident[]
): SpatialIncident[] {
  const unique = incidents
    .filter(
      (incident, index, candidates) =>
        candidates.findIndex((candidate) => candidate.id === incident.id) ===
        index
    )
    .slice(0, MAX_SPATIAL_INCIDENTS)
    .map(cloneIncident);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  notifyChanged(unique);
  return unique;
}

export function createSpatialIncident(
  current: readonly SpatialIncident[],
  input: SpatialIncidentCreateInput
): SpatialIncident[] {
  const title = boundedText(input.title, 160);
  if (!title) throw new Error('Spatial incident title is required');

  const now = new Date().toISOString();
  const dossier = input.dossier ?? null;
  const canonicalId = dossier?.entity.canonicalId ?? null;
  const pinned = canonicalId
    ? loadSpatialWorkset().some((item) => item.canonicalId === canonicalId)
    : false;

  const incident: SpatialIncident = {
    schemaVersion: 'aethergrid.operator-spatial-incident.v1',
    id: incidentId(),
    authoritative: false,
    operatorGenerated: true,
    title,
    note: boundedText(input.note, 2_000),
    category: CATEGORIES.has(input.category) ? input.category : 'note',
    severity: SEVERITIES.has(input.severity) ? input.severity : 'info',
    status: 'open',
    createdAt: now,
    updatedAt: now,
    observedAt: input.temporal.iso,
    resolvedAt: null,
    temporalMode: input.temporal.mode,
    sourceTime: input.temporal.sourceTime ?? null,
    scenarioId: input.temporal.scenarioId ?? null,
    anchor: {
      latitude: finiteCoordinate(input.coordinate.latitude, -90, 90),
      longitude: finiteCoordinate(input.coordinate.longitude, -180, 180),
      heightMeters:
        typeof input.coordinate.heightMeters === 'number' &&
        Number.isFinite(input.coordinate.heightMeters)
          ? input.coordinate.heightMeters
          : null,
      region: boundedText(input.region, 160) || 'UNKNOWN',
      canonicalId,
      sceneId: dossier?.entity.sceneId ?? null,
      sourceFeatureId: dossier?.entity.sourceFeatureId ?? null,
      identityBasis: dossier?.entity.identityBasis ?? null,
      gersId: dossier?.entity.gersId ?? null
    },
    linkedWorksetCanonicalId: pinned ? canonicalId : null
  };

  return saveSpatialIncidents([incident, ...current]);
}

export function updateSpatialIncidentStatus(
  current: readonly SpatialIncident[],
  id: string,
  status: SpatialIncidentStatus,
  temporalIso: string
): SpatialIncident[] {
  if (!STATUSES.has(status)) return [...current];
  const now = new Date().toISOString();
  return saveSpatialIncidents(
    current.map((incident) =>
      incident.id === id
        ? {
            ...incident,
            status,
            updatedAt: now,
            resolvedAt:
              status === 'resolved' || status === 'dismissed'
                ? temporalIso
                : null
          }
        : incident
    )
  );
}

export function updateSpatialIncidentNote(
  current: readonly SpatialIncident[],
  id: string,
  note: string
): SpatialIncident[] {
  const now = new Date().toISOString();
  return saveSpatialIncidents(
    current.map((incident) =>
      incident.id === id
        ? {
            ...incident,
            note: boundedText(note, 2_000),
            updatedAt: now
          }
        : incident
    )
  );
}

export function syncSpatialIncidentWorksetLink(
  current: readonly SpatialIncident[],
  id: string
): SpatialIncident[] {
  const worksetIds = new Set(loadSpatialWorkset().map((item) => item.canonicalId));
  const now = new Date().toISOString();
  return saveSpatialIncidents(
    current.map((incident) => {
      if (incident.id !== id) return incident;
      const canonicalId = incident.anchor.canonicalId;
      return {
        ...incident,
        updatedAt: now,
        linkedWorksetCanonicalId:
          canonicalId && worksetIds.has(canonicalId) ? canonicalId : null
      };
    })
  );
}

export function removeSpatialIncident(
  current: readonly SpatialIncident[],
  id: string
): SpatialIncident[] {
  return saveSpatialIncidents(current.filter((incident) => incident.id !== id));
}

export function clearSpatialIncidents(): SpatialIncident[] {
  localStorage.removeItem(STORAGE_KEY);
  notifyChanged([]);
  return [];
}

function severityIntensity(severity: SpatialIncidentSeverity): number {
  return severity === 'critical'
    ? 1
    : severity === 'high'
      ? 0.86
      : severity === 'medium'
        ? 0.68
        : severity === 'low'
          ? 0.5
          : 0.36;
}

export function spatialIncidentsToOverlay(
  incidents: readonly SpatialIncident[],
  temporal: TemporalInstant
): SpatialOverlaySnapshot {
  return {
    id: 'operator-spatial-incidents',
    layerId: 'annotations',
    eventTime: temporal.iso,
    sourceTime: null,
    fetchedAt: null,
    live: false,
    stale: false,
    fallback: false,
    attribution: 'Local operator annotation · non-authoritative',
    nodes: incidents.map((incident) => ({
      id: incident.id,
      kind: 'event' as const,
      position: {
        latitude: incident.anchor.latitude,
        longitude: incident.anchor.longitude,
        heightMeters: incident.anchor.heightMeters ?? 0
      },
      label: incident.title,
      intensity: severityIntensity(incident.severity),
      validFrom: incident.observedAt,
      validTo: incident.resolvedAt,
      properties: {
        eventType: 'operator-incident',
        localOperatorAnnotation: true,
        authoritative: false,
        incidentId: incident.id,
        category: incident.category,
        severity: incident.severity,
        status: incident.status,
        note: incident.note,
        region: incident.anchor.region,
        linkedCanonicalId: incident.anchor.canonicalId,
        linkedWorksetCanonicalId: incident.linkedWorksetCanonicalId,
        sourceFeatureId: incident.id,
        sourceDataset: 'local-operator-incidents',
        observedAt: incident.observedAt,
        updatedAt: incident.updatedAt,
        resolvedAt: incident.resolvedAt
      }
    })),
    edges: [],
    areas: []
  };
}

export function buildSpatialIncidentExport(
  incidents: readonly SpatialIncident[]
): SpatialIncidentExport {
  return {
    schemaVersion: 'aethergrid.operator-spatial-incidents.v1',
    kind: 'operator-spatial-incidents',
    authoritative: false,
    generatedAt: new Date().toISOString(),
    incidentCount: Math.min(incidents.length, MAX_SPATIAL_INCIDENTS),
    note:
      'Local operator-created annotations and incident records. They are not provider telemetry, server evidence-ledger records, or verified causal findings.',
    incidents: Object.freeze(
      incidents.slice(0, MAX_SPATIAL_INCIDENTS).map(cloneIncident)
    )
  };
}

export function downloadSpatialIncidents(
  incidents: readonly SpatialIncident[]
): void {
  const payload = buildSpatialIncidentExport(incidents);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aethergrid-spatial-incidents-${payload.generatedAt
    .replaceAll(':', '-')
    .replaceAll('.', '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
