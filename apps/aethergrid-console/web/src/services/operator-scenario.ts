import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';
import type { TemporalInstant } from '../renderer/spatial-renderer';
import {
  scenarioVisualState,
  type ScenarioId,
  type ScenarioParameters,
  type ScenarioVisualState
} from './scenario-client';
import type { SpatialIncident } from './spatial-incidents';
import type { SpatialObservation } from './spatial-comparison';
import type { SpatialWorksetItem } from './spatial-workset';
import type { SpatialWorksetGeometrySummary } from './spatial-workset-geometry';

export type OperatorScenarioStatus = 'draft' | 'active' | 'archived';

export interface OperatorScenarioAssumption {
  id: string;
  text: string;
  createdAt: string;
}

export interface OperatorScenarioReferences {
  canonicalEntityIds: readonly string[];
  incidentIds: readonly string[];
  observationIds: readonly string[];
  regions: readonly string[];
}

export interface OperatorScenarioBaseline {
  capturedAt: string;
  temporal: {
    iso: string;
    mode: TemporalInstant['mode'];
    liveReferenceIso: string | null;
  };
  region: string;
  positionedEntityCount: number;
  analyticalEdgeCount: number;
  totalTreeDistanceMeters: number;
  maximumPairDistanceMeters: number;
}

export interface OperatorScenario {
  schemaVersion: 'aethergrid.operator-scenario.v1';
  kind: 'operator-scenario';
  authoritative: false;
  modeled: true;
  id: string;
  version: number;
  parentScenarioId: string | null;
  name: string;
  description: string;
  status: OperatorScenarioStatus;
  template: ScenarioId;
  parameters: ScenarioParameters;
  startIso: string;
  endIso: string | null;
  createdAt: string;
  updatedAt: string;
  assumptions: readonly OperatorScenarioAssumption[];
  references: OperatorScenarioReferences;
  baseline: OperatorScenarioBaseline;
}

export interface OperatorScenarioContext {
  region: string;
  temporal: TemporalInstant;
  workset: readonly SpatialWorksetItem[];
  incidents: readonly SpatialIncident[];
  observationA: SpatialObservation | null;
  observationB: SpatialObservation | null;
  geometry: SpatialWorksetGeometrySummary;
}

export interface OperatorScenarioComparison {
  authoritative: false;
  modeled: true;
  baselineParameters: ScenarioParameters;
  scenarioParameters: ScenarioParameters;
  deltas: {
    loadMultiplierPercent: number;
    renewableAvailabilityPercent: number;
    storageReservePercent: number;
    weatherRiskPercent: number;
  };
  visual: ScenarioVisualState;
}

export interface OperatorScenarioExport {
  schemaVersion: 'aethergrid.operator-scenario-export.v1';
  kind: 'operator-scenario-export';
  authoritative: false;
  modeled: true;
  exportedAt: string;
  note: string;
  scenario: OperatorScenario;
  comparison: OperatorScenarioComparison;
}

const STORAGE_KEY = 'aethergrid.operator.scenarios.v4';
export const MAX_OPERATOR_SCENARIOS = 8;
export const MAX_OPERATOR_SCENARIO_ASSUMPTIONS = 16;

export const NEUTRAL_SCENARIO_PARAMETERS: ScenarioParameters = {
  loadMultiplierPercent: 100,
  renewableAvailabilityPercent: 100,
  storageReservePercent: 18,
  weatherRiskPercent: 0
};

const STATUSES = new Set<OperatorScenarioStatus>([
  'draft',
  'active',
  'archived'
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function iso(value: string, fallback: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function finiteOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedParameters(
  parameters: ScenarioParameters
): ScenarioParameters {
  return {
    loadMultiplierPercent: clamp(
      finiteOr(parameters.loadMultiplierPercent, 100),
      50,
      200
    ),
    renewableAvailabilityPercent: clamp(
      finiteOr(parameters.renewableAvailabilityPercent, 100),
      0,
      200
    ),
    storageReservePercent: clamp(
      finiteOr(parameters.storageReservePercent, 18),
      0,
      100
    ),
    weatherRiskPercent: clamp(
      finiteOr(parameters.weatherRiskPercent, 0),
      0,
      100
    )
  };
}

function unique(values: readonly string[], limit: number): string[] {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function validScenario(value: unknown): value is OperatorScenario {
  if (!value || typeof value !== 'object') return false;
  const scenario = value as Partial<OperatorScenario>;
  return (
    scenario.schemaVersion === 'aethergrid.operator-scenario.v1' &&
    scenario.kind === 'operator-scenario' &&
    scenario.authoritative === false &&
    scenario.modeled === true &&
    typeof scenario.id === 'string' &&
    typeof scenario.version === 'number' &&
    Number.isInteger(scenario.version) &&
    scenario.version >= 1 &&
    (scenario.parentScenarioId == null ||
      typeof scenario.parentScenarioId === 'string') &&
    typeof scenario.name === 'string' &&
    typeof scenario.description === 'string' &&
    STATUSES.has(scenario.status as OperatorScenarioStatus) &&
    typeof scenario.template === 'string' &&
    Boolean(scenario.parameters) &&
    typeof scenario.startIso === 'string' &&
    typeof scenario.createdAt === 'string' &&
    typeof scenario.updatedAt === 'string' &&
    Array.isArray(scenario.assumptions) &&
    Boolean(scenario.references) &&
    Boolean(scenario.baseline)
  );
}

export function loadOperatorScenarios(): OperatorScenario[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(validScenario)
      .slice(0, MAX_OPERATOR_SCENARIOS)
      .map((scenario) => ({
        ...clone(scenario),
        status: scenario.status === 'active' ? 'draft' : scenario.status
      }));
  } catch {
    return [];
  }
}

export function saveOperatorScenarios(
  scenarios: readonly OperatorScenario[]
): OperatorScenario[] {
  const uniqueScenarios = scenarios
    .filter(
      (scenario, index, candidates) =>
        candidates.findIndex((candidate) => candidate.id === scenario.id) ===
        index
    )
    .slice(0, MAX_OPERATOR_SCENARIOS)
    .map((scenario) => clone(scenario));

  localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueScenarios));
  return uniqueScenarios;
}

export function createOperatorScenario(
  name: string,
  description: string,
  template: ScenarioId,
  parameters: ScenarioParameters,
  startIso: string,
  endIso: string | null,
  context: OperatorScenarioContext
): OperatorScenario {
  const now = new Date().toISOString();
  const start = iso(startIso, context.temporal.iso);
  const parsedEnd = endIso ? Date.parse(endIso) : Number.NaN;
  const end =
    Number.isFinite(parsedEnd) && parsedEnd >= Date.parse(start)
      ? new Date(parsedEnd).toISOString()
      : null;

  return {
    schemaVersion: 'aethergrid.operator-scenario.v1',
    kind: 'operator-scenario',
    authoritative: false,
    modeled: true,
    id: `scenario:${now}:${Math.random().toString(36).slice(2, 8)}`,
    version: 1,
    parentScenarioId: null,
    name: boundedText(name, 120) || 'Operator Scenario',
    description: boundedText(description, 1_500),
    status: 'draft',
    template,
    parameters: normalizedParameters(parameters),
    startIso: start,
    endIso: end,
    createdAt: now,
    updatedAt: now,
    assumptions: [],
    references: {
      canonicalEntityIds: unique(
        context.workset.map((item) => item.canonicalId),
        48
      ),
      incidentIds: unique(
        context.incidents.map((incident) => incident.id),
        96
      ),
      observationIds: unique(
        [context.observationA?.id, context.observationB?.id].filter(
          (value): value is string => Boolean(value)
        ),
        24
      ),
      regions: unique(
        [
          context.region,
          ...context.workset.map((item) => item.dossier.region)
        ],
        24
      )
    },
    baseline: {
      capturedAt: now,
      temporal: {
        iso: context.temporal.iso,
        mode: context.temporal.mode,
        liveReferenceIso: context.temporal.sourceTime ?? null
      },
      region: context.region,
      positionedEntityCount: context.geometry.positionedEntityCount,
      analyticalEdgeCount: context.geometry.edgeCount,
      totalTreeDistanceMeters: context.geometry.totalTreeDistanceMeters,
      maximumPairDistanceMeters: context.geometry.maximumPairDistanceMeters
    }
  };
}

export function branchOperatorScenario(
  scenario: OperatorScenario
): OperatorScenario {
  const now = new Date().toISOString();
  const nextVersion = scenario.version + 1;
  return {
    ...clone(scenario),
    id: `scenario:${now}:${Math.random().toString(36).slice(2, 8)}`,
    version: nextVersion,
    parentScenarioId: scenario.id,
    name: boundedText(`${scenario.name} · v${nextVersion}`, 120),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    assumptions: scenario.assumptions.map((assumption) => ({
      ...assumption,
      id: `scenario-assumption:${now}:${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      createdAt: now
    }))
  };
}

export function upsertOperatorScenario(
  current: readonly OperatorScenario[],
  scenario: OperatorScenario
): OperatorScenario[] {
  return saveOperatorScenarios([
    clone(scenario),
    ...current.filter((candidate) => candidate.id !== scenario.id)
  ]);
}

export function removeOperatorScenario(
  current: readonly OperatorScenario[],
  id: string
): OperatorScenario[] {
  return saveOperatorScenarios(
    current.filter((scenario) => scenario.id !== id)
  );
}

export function setOperatorScenarioStatus(
  scenario: OperatorScenario,
  status: OperatorScenarioStatus
): OperatorScenario {
  if (!STATUSES.has(status)) return clone(scenario);
  return {
    ...clone(scenario),
    status,
    updatedAt: new Date().toISOString()
  };
}

export function updateOperatorScenarioParameters(
  scenario: OperatorScenario,
  parameters: ScenarioParameters
): OperatorScenario {
  return {
    ...clone(scenario),
    parameters: normalizedParameters(parameters),
    updatedAt: new Date().toISOString()
  };
}

export function addOperatorScenarioAssumption(
  scenario: OperatorScenario,
  text: string
): OperatorScenario {
  const safe = boundedText(text, 1_000);
  if (!safe) return clone(scenario);
  const now = new Date().toISOString();
  return {
    ...clone(scenario),
    updatedAt: now,
    assumptions: [
      {
        id: `scenario-assumption:${now}:${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        text: safe,
        createdAt: now
      },
      ...scenario.assumptions
    ].slice(0, MAX_OPERATOR_SCENARIO_ASSUMPTIONS)
  };
}

export function removeOperatorScenarioAssumption(
  scenario: OperatorScenario,
  assumptionId: string
): OperatorScenario {
  return {
    ...clone(scenario),
    updatedAt: new Date().toISOString(),
    assumptions: scenario.assumptions.filter(
      (assumption) => assumption.id !== assumptionId
    )
  };
}

export function compareOperatorScenario(
  scenario: OperatorScenario
): OperatorScenarioComparison {
  const parameters = normalizedParameters(scenario.parameters);
  return {
    authoritative: false,
    modeled: true,
    baselineParameters: { ...NEUTRAL_SCENARIO_PARAMETERS },
    scenarioParameters: { ...parameters },
    deltas: {
      loadMultiplierPercent:
        parameters.loadMultiplierPercent -
        NEUTRAL_SCENARIO_PARAMETERS.loadMultiplierPercent,
      renewableAvailabilityPercent:
        parameters.renewableAvailabilityPercent -
        NEUTRAL_SCENARIO_PARAMETERS.renewableAvailabilityPercent,
      storageReservePercent:
        parameters.storageReservePercent -
        NEUTRAL_SCENARIO_PARAMETERS.storageReservePercent,
      weatherRiskPercent:
        parameters.weatherRiskPercent -
        NEUTRAL_SCENARIO_PARAMETERS.weatherRiskPercent
    },
    visual: scenarioVisualState(scenario.template, parameters)
  };
}

function scenarioNodeIntensity(scenario: OperatorScenario): number {
  const comparison = compareOperatorScenario(scenario);
  return clamp(
    0.35 +
      (comparison.visual.stressFactor - 0.65) / 1.7 +
      comparison.visual.weatherRisk * 0.2,
    0.2,
    1
  );
}

export function operatorScenarioToOverlay(
  scenario: OperatorScenario,
  geometry: SpatialWorksetGeometrySummary,
  temporal: TemporalInstant
): SpatialOverlaySnapshot {
  const byId = new Map(
    geometry.nodes.map((node) => [node.canonicalId, node])
  );

  return {
    id: `operator-scenario:${scenario.id}`,
    layerId: 'scenario-model',
    eventTime: temporal.iso,
    sourceTime: null,
    fetchedAt: null,
    live: false,
    stale: false,
    fallback: false,
    attribution: 'Local operator scenario model · non-authoritative',
    nodes: geometry.nodes.map((node) => ({
      id: `scenario-model-node:${scenario.id}:${node.canonicalId}`,
      kind: 'analysis-point' as const,
      position: {
        latitude: node.latitude,
        longitude: node.longitude,
        heightMeters: node.heightMeters + 36
      },
      label: `${scenario.name} · ${node.displayName}`,
      intensity: scenarioNodeIntensity(scenario),
      validFrom: scenario.startIso,
      validTo: scenario.endIso,
      properties: {
        analysisType: 'scenario-model',
        authoritative: false,
        modeled: true,
        scenarioId: scenario.id,
        template: scenario.template,
        canonicalId: node.canonicalId,
        relationshipBasis: geometry.relationshipBasis,
        sourceFeatureId: node.canonicalId,
        sourceDataset: 'local-operator-scenario'
      }
    })),
    edges: geometry.edges.flatMap((edge) => {
      const from = byId.get(edge.fromCanonicalId);
      const to = byId.get(edge.toCanonicalId);
      if (!from || !to) return [];
      return [
        {
          id: `scenario-model-edge:${scenario.id}:${edge.id}`,
          kind: 'analysis-line' as const,
          from: {
            latitude: from.latitude,
            longitude: from.longitude,
            heightMeters: from.heightMeters + 36
          },
          to: {
            latitude: to.latitude,
            longitude: to.longitude,
            heightMeters: to.heightMeters + 36
          },
          label: 'Modeled scenario geometry',
          value: edge.distanceMeters,
          unit: 'm',
          intensity: 0.72,
          validFrom: scenario.startIso,
          validTo: scenario.endIso,
          properties: {
            analysisType: 'scenario-model',
            authoritative: false,
            modeled: true,
            scenarioId: scenario.id,
            relationshipBasis: geometry.relationshipBasis,
            fromCanonicalId: edge.fromCanonicalId,
            toCanonicalId: edge.toCanonicalId,
            sourceFeatureId: edge.id,
            sourceDataset: 'local-operator-scenario'
          }
        }
      ];
    }),
    areas: []
  };
}

export function buildOperatorScenarioExport(
  scenario: OperatorScenario
): OperatorScenarioExport {
  return {
    schemaVersion: 'aethergrid.operator-scenario-export.v1',
    kind: 'operator-scenario-export',
    authoritative: false,
    modeled: true,
    exportedAt: new Date().toISOString(),
    note:
      'Operator-authored hypothetical scenario. Parameters, assumptions, modeled geometry and visual stress values are not observations, forecasts, provider telemetry, causal findings or verified real-world outcomes.',
    scenario: clone(scenario),
    comparison: compareOperatorScenario(scenario)
  };
}

export function downloadOperatorScenario(scenario: OperatorScenario): void {
  const payload = buildOperatorScenarioExport(scenario);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aethergrid-scenario-${scenario.name
    .replace(/[^a-z0-9._-]+/giu, '-')
    .slice(0, 60)}-${payload.exportedAt
    .replaceAll(':', '-')
    .replaceAll('.', '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
