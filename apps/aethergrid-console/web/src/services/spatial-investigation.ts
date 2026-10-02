import type { EvidenceRecord } from './evidence-client';
import type { SpatialIncident } from './spatial-incidents';
import type { SpatialObservation } from './spatial-comparison';
import type { SpatialWorksetItem } from './spatial-workset';
import type { SpatialWorksetGeometrySummary } from './spatial-workset-geometry';

export type SpatialInvestigationStatus = 'open' | 'monitoring' | 'closed';
export type InvestigationAssessment =
  | 'untested'
  | 'supported'
  | 'contradicted'
  | 'inconclusive';

export interface SpatialInvestigationHypothesis {
  id: string;
  text: string;
  assessment: InvestigationAssessment;
  rationale: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpatialInvestigationReferences {
  canonicalEntityIds: readonly string[];
  incidentIds: readonly string[];
  observationIds: readonly string[];
  evidenceReceipts: readonly string[];
}

export interface SpatialInvestigationGeometrySnapshot {
  authoritative: false;
  relationshipBasis: SpatialWorksetGeometrySummary['relationshipBasis'];
  positionedEntityCount: number;
  edgeCount: number;
  totalTreeDistanceMeters: number;
  maximumPairDistanceMeters: number;
  regions: readonly string[];
  capturedAt: string;
}

export interface SpatialInvestigation {
  schemaVersion: 'aethergrid.operator-spatial-investigation.v1';
  kind: 'operator-spatial-investigation';
  authoritative: false;
  operatorAssessment: true;
  id: string;
  name: string;
  objective: string;
  status: SpatialInvestigationStatus;
  createdAt: string;
  updatedAt: string;
  references: SpatialInvestigationReferences;
  geometry: SpatialInvestigationGeometrySnapshot | null;
  hypotheses: readonly SpatialInvestigationHypothesis[];
  openQuestions: readonly string[];
  notes: readonly string[];
}

export interface SpatialInvestigationContext {
  workset: readonly SpatialWorksetItem[];
  incidents: readonly SpatialIncident[];
  observationA: SpatialObservation | null;
  observationB: SpatialObservation | null;
  geometry: SpatialWorksetGeometrySummary;
  evidence: EvidenceRecord | null;
}

export interface SpatialInvestigationExport {
  schemaVersion: 'aethergrid.operator-spatial-investigation-export.v1';
  kind: 'operator-spatial-investigation-export';
  authoritative: false;
  exportedAt: string;
  note: string;
  investigation: SpatialInvestigation;
}

const STORAGE_KEY = 'aethergrid.operator.spatial-investigations.v4';
export const MAX_SPATIAL_INVESTIGATIONS = 6;
export const MAX_INVESTIGATION_HYPOTHESES = 12;
export const MAX_INVESTIGATION_QUESTIONS = 16;
export const MAX_INVESTIGATION_NOTES = 24;

const ASSESSMENTS = new Set<InvestigationAssessment>([
  'untested',
  'supported',
  'contradicted',
  'inconclusive'
]);

const STATUSES = new Set<SpatialInvestigationStatus>([
  'open',
  'monitoring',
  'closed'
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function boundedText(value: unknown, limit: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
    .trim()
    .slice(0, limit);
}

function unique(values: readonly string[], limit: number): string[] {
  return [...new Set(values.map((value) => boundedText(value, 240)).filter(Boolean))].slice(
    0,
    limit
  );
}

function validInvestigation(value: unknown): value is SpatialInvestigation {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SpatialInvestigation>;
  return (
    item.schemaVersion === 'aethergrid.operator-spatial-investigation.v1' &&
    item.kind === 'operator-spatial-investigation' &&
    item.authoritative === false &&
    item.operatorAssessment === true &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.objective === 'string' &&
    STATUSES.has(item.status as SpatialInvestigationStatus) &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string' &&
    Boolean(item.references) &&
    Array.isArray(item.references?.canonicalEntityIds) &&
    Array.isArray(item.references?.incidentIds) &&
    Array.isArray(item.references?.observationIds) &&
    Array.isArray(item.references?.evidenceReceipts) &&
    Array.isArray(item.hypotheses) &&
    Array.isArray(item.openQuestions) &&
    Array.isArray(item.notes)
  );
}

function hypothesisId(): string {
  return `hypothesis:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function evidenceReference(record: EvidenceRecord | null): string | null {
  if (!record) return null;
  return boundedText(record.receipt || record.id, 240) || null;
}

export function loadSpatialInvestigations(): SpatialInvestigation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(validInvestigation)
      .slice(0, MAX_SPATIAL_INVESTIGATIONS)
      .map((item) => clone(item));
  } catch {
    return [];
  }
}

export function saveSpatialInvestigations(
  investigations: readonly SpatialInvestigation[]
): SpatialInvestigation[] {
  const uniqueItems = investigations
    .filter(
      (item, index, candidates) =>
        candidates.findIndex((candidate) => candidate.id === item.id) === index
    )
    .slice(0, MAX_SPATIAL_INVESTIGATIONS)
    .map((item) => clone(item));

  localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueItems));
  return uniqueItems;
}

export function createSpatialInvestigation(
  name: string,
  objective: string
): SpatialInvestigation {
  const now = new Date().toISOString();
  return {
    schemaVersion: 'aethergrid.operator-spatial-investigation.v1',
    kind: 'operator-spatial-investigation',
    authoritative: false,
    operatorAssessment: true,
    id: `investigation:${now}:${Math.random().toString(36).slice(2, 8)}`,
    name: boundedText(name, 120) || 'Spatial Investigation',
    objective: boundedText(objective, 1_000),
    status: 'open',
    createdAt: now,
    updatedAt: now,
    references: {
      canonicalEntityIds: [],
      incidentIds: [],
      observationIds: [],
      evidenceReceipts: []
    },
    geometry: null,
    hypotheses: [],
    openQuestions: [],
    notes: []
  };
}

export function upsertSpatialInvestigation(
  current: readonly SpatialInvestigation[],
  investigation: SpatialInvestigation
): SpatialInvestigation[] {
  return saveSpatialInvestigations([
    clone(investigation),
    ...current.filter((item) => item.id !== investigation.id)
  ]);
}

export function removeSpatialInvestigation(
  current: readonly SpatialInvestigation[],
  id: string
): SpatialInvestigation[] {
  return saveSpatialInvestigations(current.filter((item) => item.id !== id));
}

export function attachSpatialInvestigationContext(
  investigation: SpatialInvestigation,
  context: SpatialInvestigationContext
): SpatialInvestigation {
  const now = new Date().toISOString();
  const observationIds = [
    context.observationA?.id,
    context.observationB?.id
  ].filter((value): value is string => Boolean(value));
  const evidence = evidenceReference(context.evidence);

  return {
    ...clone(investigation),
    updatedAt: now,
    references: {
      canonicalEntityIds: unique(
        [
          ...investigation.references.canonicalEntityIds,
          ...context.workset.map((item) => item.canonicalId)
        ],
        48
      ),
      incidentIds: unique(
        [
          ...investigation.references.incidentIds,
          ...context.incidents.map((incident) => incident.id)
        ],
        96
      ),
      observationIds: unique(
        [...investigation.references.observationIds, ...observationIds],
        24
      ),
      evidenceReceipts: unique(
        [
          ...investigation.references.evidenceReceipts,
          ...(evidence ? [evidence] : [])
        ],
        48
      )
    },
    geometry:
      context.geometry.positionedEntityCount > 0
        ? {
            authoritative: false,
            relationshipBasis: context.geometry.relationshipBasis,
            positionedEntityCount: context.geometry.positionedEntityCount,
            edgeCount: context.geometry.edgeCount,
            totalTreeDistanceMeters: context.geometry.totalTreeDistanceMeters,
            maximumPairDistanceMeters:
              context.geometry.maximumPairDistanceMeters,
            regions: [...context.geometry.regions],
            capturedAt: now
          }
        : investigation.geometry
  };
}

export function attachEvidenceToInvestigation(
  investigation: SpatialInvestigation,
  evidence: EvidenceRecord
): SpatialInvestigation {
  const reference = evidenceReference(evidence);
  if (!reference) return clone(investigation);
  return {
    ...clone(investigation),
    updatedAt: new Date().toISOString(),
    references: {
      ...clone(investigation.references),
      evidenceReceipts: unique(
        [...investigation.references.evidenceReceipts, reference],
        48
      )
    }
  };
}

export function setSpatialInvestigationStatus(
  investigation: SpatialInvestigation,
  status: SpatialInvestigationStatus
): SpatialInvestigation {
  if (!STATUSES.has(status)) return clone(investigation);
  return {
    ...clone(investigation),
    status,
    updatedAt: new Date().toISOString()
  };
}

export function addSpatialInvestigationHypothesis(
  investigation: SpatialInvestigation,
  text: string
): SpatialInvestigation {
  const safeText = boundedText(text, 1_000);
  if (!safeText) return clone(investigation);
  const now = new Date().toISOString();
  const hypothesis: SpatialInvestigationHypothesis = {
    id: hypothesisId(),
    text: safeText,
    assessment: 'untested',
    rationale: '',
    createdAt: now,
    updatedAt: now
  };

  return {
    ...clone(investigation),
    updatedAt: now,
    hypotheses: [hypothesis, ...investigation.hypotheses].slice(
      0,
      MAX_INVESTIGATION_HYPOTHESES
    )
  };
}

export function assessSpatialInvestigationHypothesis(
  investigation: SpatialInvestigation,
  hypothesisIdValue: string,
  assessment: InvestigationAssessment,
  rationale: string
): SpatialInvestigation {
  if (!ASSESSMENTS.has(assessment)) return clone(investigation);
  const now = new Date().toISOString();
  return {
    ...clone(investigation),
    updatedAt: now,
    hypotheses: investigation.hypotheses.map((hypothesis) =>
      hypothesis.id === hypothesisIdValue
        ? {
            ...hypothesis,
            assessment,
            rationale: boundedText(rationale, 2_000),
            updatedAt: now
          }
        : hypothesis
    )
  };
}

export function addSpatialInvestigationQuestion(
  investigation: SpatialInvestigation,
  question: string
): SpatialInvestigation {
  const safe = boundedText(question, 800);
  if (!safe) return clone(investigation);
  return {
    ...clone(investigation),
    updatedAt: new Date().toISOString(),
    openQuestions: unique(
      [safe, ...investigation.openQuestions],
      MAX_INVESTIGATION_QUESTIONS
    )
  };
}

export function addSpatialInvestigationNote(
  investigation: SpatialInvestigation,
  note: string
): SpatialInvestigation {
  const safe = boundedText(note, 2_000);
  if (!safe) return clone(investigation);
  return {
    ...clone(investigation),
    updatedAt: new Date().toISOString(),
    notes: [safe, ...investigation.notes].slice(0, MAX_INVESTIGATION_NOTES)
  };
}

export function buildSpatialInvestigationExport(
  investigation: SpatialInvestigation
): SpatialInvestigationExport {
  return {
    schemaVersion: 'aethergrid.operator-spatial-investigation-export.v1',
    kind: 'operator-spatial-investigation-export',
    authoritative: false,
    exportedAt: new Date().toISOString(),
    note:
      'Operator investigation workspace. Hypothesis assessments are human-entered analytical judgments, not verified provider findings. Evidence references point to separate source/provenance records and should be revalidated independently.',
    investigation: clone(investigation)
  };
}

export function downloadSpatialInvestigation(
  investigation: SpatialInvestigation
): void {
  const payload = buildSpatialInvestigationExport(investigation);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aethergrid-investigation-${investigation.name
    .replace(/[^a-z0-9._-]+/giu, '-')
    .slice(0, 60)}-${payload.exportedAt
    .replaceAll(':', '-')
    .replaceAll('.', '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
