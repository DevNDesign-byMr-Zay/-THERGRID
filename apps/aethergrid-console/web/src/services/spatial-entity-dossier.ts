import type { AtmosphericOverlaySnapshot } from '../renderer/overlays/atmospheric-overlay';
import type {
  SpatialFeatureSelection,
  TemporalInstant,
  VisualMode
} from '../renderer/spatial-renderer';
import type { CityLiveSnapshot } from './city-live-context';
import type { CityIdentitySummary } from './city-power-overlay';
import type { SpatialMeasurement } from './spatial-analysis';
import type { SpatialObservation } from './spatial-comparison';

export type EntitySourceState =
  | 'live'
  | 'stale'
  | 'fallback'
  | 'recorded'
  | 'unknown';

export interface EntityDossierSource {
  role: 'entity' | 'city-geometry' | 'weather' | 'air-quality' | 'seismic';
  provider: string | null;
  dataset: string | null;
  sourceTime: string | null;
  fetchedAt: string | null;
  attribution: string | null;
  state: EntitySourceState;
}

export interface SpatialEntityDossier {
  schemaVersion: 'aethergrid.operator-entity-dossier.v1';
  kind: 'operator-entity-dossier';
  authoritative: false;
  generatedAt: string;
  frozen: boolean;
  region: string;
  visualMode: VisualMode;
  useCase: string | null;
  temporal: {
    iso: string;
    mode: TemporalInstant['mode'];
    sourceTime: string | null;
    scenarioId: string | null;
  };
  entity: {
    canonicalId: string;
    sceneId: string;
    displayName: string;
    kind: string;
    identityBasis: string;
    source: string | null;
    sourceFeatureId: string | null;
    gersId: string | null;
    osmId: string | null;
    crossSourceJoinReady: boolean;
    layerId: string | null;
    position: {
      latitude: number | null;
      longitude: number | null;
      heightMeters: number | null;
    };
    properties: Readonly<Record<string, string | number | boolean | null>>;
  };
  entitySource: EntityDossierSource;
  contextSources: readonly EntityDossierSource[];
  operatorMeasurement: {
    distanceMeters: number;
    bearingDegrees: number;
    elevationDeltaMeters: number | null;
    slopePercent: number | null;
    precision: SpatialMeasurement['precision'];
    relation: 'scene-context-only';
  } | null;
  matchingObservations: readonly {
    slot: 'A' | 'B';
    observationId: string;
    capturedAt: string;
    frameIso: string;
    temporalMode: TemporalInstant['mode'];
  }[];
  coverage: {
    percent: number;
    checks: readonly {
      id: string;
      label: string;
      present: boolean;
      required: boolean;
    }[];
  };
  limitations: readonly string[];
}

export interface SpatialEntityDossierInput {
  region: string;
  temporal: TemporalInstant;
  visualMode: VisualMode;
  useCase: string | null;
  selection: SpatialFeatureSelection;
  measurement: SpatialMeasurement | null;
  observationA: SpatialObservation | null;
  observationB: SpatialObservation | null;
  cityIdentity: CityIdentitySummary | null;
  atmosphere: AtmosphericOverlaySnapshot | null;
  liveContext: CityLiveSnapshot | null;
}

const SENSITIVE_KEY = /(api.?key|token|secret|password|credential|authorization|service.?crn)/iu;

function propertyString(
  properties: Readonly<Record<string, unknown>> | undefined,
  key: string
): string | null {
  const value = properties?.[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function publicScalarProperties(
  properties: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, string | number | boolean | null>> {
  if (!properties) return Object.freeze({});

  const safeEntries = Object.entries(properties)
    .filter(([key]) => !SENSITIVE_KEY.test(key))
    .flatMap(([key, value]) => {
      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
      ) {
        return [[key, value] as const];
      }
      return [];
    })
    .slice(0, 24);

  return Object.freeze(Object.fromEntries(safeEntries));
}

function selectionSourceState(
  selection: SpatialFeatureSelection
): EntitySourceState {
  if (selection.properties?.stale === true) return 'stale';
  if (selection.properties?.fallback === true) return 'fallback';
  if (selection.properties?.live === true) return 'live';
  if (
    selection.source ||
    selection.properties?.sourceTime ||
    selection.properties?.fetchedAt
  ) {
    return 'recorded';
  }
  return 'unknown';
}

function contextSourceState(live: boolean | undefined): EntitySourceState {
  return live === true ? 'live' : live === false ? 'fallback' : 'unknown';
}

function observationReference(
  slot: 'A' | 'B',
  observation: SpatialObservation | null,
  canonicalId: string
): SpatialEntityDossier['matchingObservations'][number] | null {
  if (!observation?.selectedEntity) return null;
  if (observation.selectedEntity.canonicalId !== canonicalId) return null;
  return {
    slot,
    observationId: observation.id,
    capturedAt: observation.capturedAt,
    frameIso: observation.temporal.iso,
    temporalMode: observation.temporal.mode
  };
}

export function buildSpatialEntityDossier(
  input: SpatialEntityDossierInput
): SpatialEntityDossier {
  const selection = input.selection;
  const identity = selection.identity;
  const canonicalId = identity?.canonicalId ?? selection.id;
  const sourceDataset =
    propertyString(selection.properties, 'sourceDataset') ??
    propertyString(selection.properties, 'layerId');
  const entitySource: EntityDossierSource = {
    role: 'entity',
    provider:
      propertyString(selection.properties, 'sourceProvider') ??
      sourceDataset ??
      selection.source ??
      null,
    dataset: sourceDataset,
    sourceTime: propertyString(selection.properties, 'sourceTime'),
    fetchedAt: propertyString(selection.properties, 'fetchedAt'),
    attribution: propertyString(selection.properties, 'attribution'),
    state: selectionSourceState(selection)
  };

  const contextSources: EntityDossierSource[] = [];
  if (input.cityIdentity) {
    contextSources.push({
      role: 'city-geometry',
      provider: input.cityIdentity.sourceProvider,
      dataset: 'city-spatial-context',
      sourceTime: input.cityIdentity.upstreamTimestamp,
      fetchedAt: null,
      attribution: input.cityIdentity.sourceProvider,
      state: contextSourceState(input.cityIdentity.live)
    });
  }

  if (input.atmosphere) {
    contextSources.push({
      role: 'weather',
      provider: null,
      dataset: 'city-environment',
      sourceTime: input.atmosphere.sourceTime,
      fetchedAt: input.atmosphere.fetchedAt,
      attribution: input.atmosphere.attribution,
      state: input.atmosphere.live
        ? 'live'
        : input.atmosphere.fallback
          ? 'fallback'
          : 'recorded'
    });
  }

  if (input.liveContext) {
    contextSources.push(
      {
        role: 'air-quality',
        provider: input.liveContext.airQuality.source.provider,
        dataset: 'air-quality',
        sourceTime: input.liveContext.airQuality.source.modelTime,
        fetchedAt: input.liveContext.airQuality.source.fetchedAt,
        attribution: input.liveContext.airQuality.source.attribution,
        state: contextSourceState(input.liveContext.airQuality.source.live)
      },
      {
        role: 'seismic',
        provider: input.liveContext.seismic.source.provider,
        dataset: 'recent-seismic-events',
        sourceTime: input.liveContext.seismic.source.generatedAt ?? null,
        fetchedAt: input.liveContext.seismic.source.fetchedAt,
        attribution: input.liveContext.seismic.source.attribution,
        state: contextSourceState(input.liveContext.seismic.source.live)
      }
    );
  }

  const matchingObservations = [
    observationReference('A', input.observationA, canonicalId),
    observationReference('B', input.observationB, canonicalId)
  ].filter(
    (
      item
    ): item is SpatialEntityDossier['matchingObservations'][number] =>
      item !== null
  );

  const position = {
    latitude: finite(selection.latitude),
    longitude: finite(selection.longitude),
    heightMeters: finite(selection.heightMeters)
  };

  const checks = [
    {
      id: 'canonical-identity',
      label: 'Canonical identity',
      present: Boolean(canonicalId),
      required: true
    },
    {
      id: 'source-lineage',
      label: 'Entity source lineage',
      present: Boolean(entitySource.provider || entitySource.dataset),
      required: true
    },
    {
      id: 'position',
      label: 'Geographic position',
      present: position.latitude !== null && position.longitude !== null,
      required: true
    },
    {
      id: 'temporal-frame',
      label: '4D temporal frame',
      present: Boolean(input.temporal.iso),
      required: true
    },
    {
      id: 'source-time',
      label: 'Entity source time',
      present: Boolean(entitySource.sourceTime),
      required: false
    },
    {
      id: 'source-feature',
      label: 'Source feature ID',
      present: Boolean(identity?.sourceFeatureId),
      required: false
    },
    {
      id: 'gers-link',
      label: 'GERS cross-source link',
      present: identity?.crossSourceJoinReady === true,
      required: false
    },
    {
      id: 'operator-measurement',
      label: 'Operator measurement',
      present: Boolean(input.measurement),
      required: false
    },
    {
      id: 'comparison-frame',
      label: 'Matching A/B capture',
      present: matchingObservations.length > 0,
      required: false
    }
  ] as const;

  const required = checks.filter((check) => check.required);
  const requiredPresent = required.filter((check) => check.present).length;
  const percent = required.length
    ? Math.round((requiredPresent / required.length) * 100)
    : 0;

  const limitations = [
    'This operator dossier is a local analytical snapshot, not a server evidence-ledger record.',
    identity?.crossSourceJoinReady
      ? 'Cross-source identity is linked by an explicit GERS identifier.'
      : 'Cross-source identity is not proven; source-native or scene identity must not be treated as a GERS join.',
    input.measurement
      ? 'The attached measurement is scene context only and is not assumed to describe the selected entity itself.'
      : 'No operator measurement is attached to this dossier.',
    input.temporal.mode === 'live'
      ? 'Current-only context may change after this dossier is generated unless the operator freezes a snapshot.'
      : 'Current-only weather, air-quality and seismic context is intentionally omitted outside LIVE mode.'
  ];

  return Object.freeze({
    schemaVersion: 'aethergrid.operator-entity-dossier.v1',
    kind: 'operator-entity-dossier',
    authoritative: false,
    generatedAt: new Date().toISOString(),
    frozen: false,
    region: input.region,
    visualMode: input.visualMode,
    useCase: input.useCase,
    temporal: {
      iso: input.temporal.iso,
      mode: input.temporal.mode,
      sourceTime: input.temporal.sourceTime ?? null,
      scenarioId: input.temporal.scenarioId ?? null
    },
    entity: {
      canonicalId,
      sceneId: selection.id,
      displayName: identity?.displayName ?? selection.id,
      kind: selection.kind,
      identityBasis: identity?.basis ?? 'scene-derived',
      source: selection.source ?? null,
      sourceFeatureId: identity?.sourceFeatureId ?? null,
      gersId: identity?.gersId ?? null,
      osmId: identity?.osmId ?? null,
      crossSourceJoinReady: identity?.crossSourceJoinReady ?? false,
      layerId:
        identity?.layerId ??
        propertyString(selection.properties, 'layerId'),
      position,
      properties: publicScalarProperties(selection.properties)
    },
    entitySource,
    contextSources: Object.freeze(contextSources),
    operatorMeasurement: input.measurement
      ? {
          distanceMeters: input.measurement.distanceMeters,
          bearingDegrees: input.measurement.bearingDegrees,
          elevationDeltaMeters: input.measurement.elevationDeltaMeters,
          slopePercent: input.measurement.slopePercent,
          precision: input.measurement.precision,
          relation: 'scene-context-only' as const
        }
      : null,
    matchingObservations: Object.freeze(matchingObservations),
    coverage: {
      percent,
      checks: Object.freeze(checks)
    },
    limitations: Object.freeze(limitations)
  });
}

export function freezeSpatialEntityDossier(
  dossier: SpatialEntityDossier
): SpatialEntityDossier {
  return Object.freeze({
    ...dossier,
    generatedAt: new Date().toISOString(),
    frozen: true,
    temporal: { ...dossier.temporal },
    entity: Object.freeze({
      ...dossier.entity,
      position: Object.freeze({ ...dossier.entity.position }),
      properties: Object.freeze({ ...dossier.entity.properties })
    }),
    entitySource: Object.freeze({ ...dossier.entitySource }),
    contextSources: Object.freeze(
      dossier.contextSources.map((source) => Object.freeze({ ...source }))
    ),
    operatorMeasurement: dossier.operatorMeasurement
      ? { ...dossier.operatorMeasurement }
      : null,
    matchingObservations: Object.freeze(
      dossier.matchingObservations.map((observation) => ({ ...observation }))
    ),
    coverage: Object.freeze({
      percent: dossier.coverage.percent,
      checks: Object.freeze(
        dossier.coverage.checks.map((check) => Object.freeze({ ...check }))
      )
    }),
    limitations: Object.freeze([...dossier.limitations])
  });
}

export function downloadSpatialEntityDossier(
  dossier: SpatialEntityDossier
): void {
  const payload = {
    ...dossier,
    exportedAt: new Date().toISOString(),
    exportNote:
      'Non-authoritative operator snapshot. Preserve source receipts and authoritative provider records separately.'
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aethergrid-entity-dossier-${dossier.entity.canonicalId
    .replace(/[^a-z0-9._-]+/giu, '-')
    .slice(0, 80)}-${payload.exportedAt
    .replaceAll(':', '-')
    .replaceAll('.', '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
