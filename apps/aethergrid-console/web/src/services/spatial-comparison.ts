import type { AtmosphericOverlaySnapshot } from '../renderer/overlays/atmospheric-overlay';
import type {
  SpatialFeatureSelection,
  TemporalInstant,
  VisualMode
} from '../renderer/spatial-renderer';
import type { CityLiveSnapshot } from './city-live-context';
import type { CityIdentitySummary } from './city-power-overlay';
import type { SpatialMeasurement } from './spatial-analysis';
import type { SpatialViewBookmark } from './view-bookmarks';

export function comparisonFrameBookmark(current: Omit<SpatialViewBookmark, 'id' | 'name' | 'createdAt'>, observation: SpatialObservation, target: SpatialViewBookmark['target']): SpatialViewBookmark {
  return { ...current, id: observation.id, name: observation.region, createdAt: observation.capturedAt,
    scope: observation.region === 'GLOBAL' ? 'world' : 'city', target: { ...target },
    visualMode: observation.visualMode, temporalMode: observation.temporal.mode, cursorIso: observation.temporal.iso,
    scenarioId: observation.temporal.scenarioId ?? null,
    scenarioVisual: observation.temporal.scenarioVisual ? { ...observation.temporal.scenarioVisual } : null,
    playbackRange: observation.temporal.range ? { ...observation.temporal.range } : null };
}

export interface SpatialObservation {
  weatherReceipt?: { state: 'live' | 'forecast' | 'stale' | 'simulated' | 'unavailable'; sourceTime: string | null; fetchedAt: string | null; attribution: string | null };
  id: string;
  capturedAt: string;
  region: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  temporal: TemporalInstant;
  useCase: string | null;
  visualMode: VisualMode;
  selectedEntity: {
    id: string;
    canonicalId: string;
    identityBasis: string;
    sourceFeatureId: string | null;
    gersId: string | null;
    crossSourceJoinReady: boolean;
    kind: string;
    source: string | null;
    layerId: string | null;
  } | null;
  measurement: {
    distanceMeters: number;
    bearingDegrees: number;
    elevationDeltaMeters: number | null;
    precision: SpatialMeasurement['precision'];
  } | null;
  metrics: {
    buildingCount: number | null;
    skylineMaxHeightM: number | null;
    skylineP95HeightM: number | null;
    temperatureC: number | null;
    windSpeedKph: number | null;
    usAqi: number | null;
    pm25UgM3: number | null;
    seismicEventCount: number | null;
    maxMagnitude: number | null;
    nearestSeismicKm: number | null;
  };
  provenance: {
    cityProvider: string | null;
    citySourceTime: string | null;
    environmentAttribution: string | null;
    environmentSourceTime: string | null;
    airQualityProvider: string | null;
    airQualitySourceTime: string | null;
    seismicProvider: string | null;
    seismicFetchedAt: string | null;
  };
}

export interface SpatialObservationInput {
  region: string;
  latitude: number;
  longitude: number;
  temporal: TemporalInstant;
  useCase: string | null;
  visualMode: VisualMode;
  cityIdentity: CityIdentitySummary | null;
  atmosphere: AtmosphericOverlaySnapshot | null;
  liveContext: CityLiveSnapshot | null;
  selection: SpatialFeatureSelection | null;
  measurement: SpatialMeasurement | null;
}

export interface SpatialMetricDelta {
  basis: 'measured' | 'forecast' | 'mapped-context' | 'mixed-source-states' | 'unverified';
  key: keyof SpatialObservation['metrics'];
  label: string;
  unit: string;
  a: number;
  b: number;
  delta: number;
}

export interface SpatialComparison {
  a: SpatialObservation;
  b: SpatialObservation;
  capturedSeparationSeconds: number;
  frameSeparationSeconds: number;
  sameCanonicalEntity: boolean | null;
  metricDeltas: readonly SpatialMetricDelta[];
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function captureSpatialObservation(
  input: SpatialObservationInput
): SpatialObservation {
  const capturedAt = new Date().toISOString();
  const live = input.temporal.mode === 'live';
  const atmosphere = input.atmosphere;
  const aligned = input.temporal.mode === 'forecast' && Boolean(atmosphere?.current && !atmosphere.fallback && (atmosphere.live || atmosphere.stale) &&
    Number.isFinite(Date.parse(atmosphere.sourceTime ?? '')) && Date.parse(atmosphere.sourceTime!) === Date.parse(input.temporal.iso) &&
    Date.parse(atmosphere.current.time ?? '') === Date.parse(input.temporal.iso));
  const weatherAvailable = Boolean(atmosphere?.current && (live || aligned));
  const weatherState = !weatherAvailable ? 'unavailable' : atmosphere!.fallback ? 'simulated' : atmosphere!.stale ? 'stale' : aligned ? 'forecast' : atmosphere!.live ? 'live' : 'unavailable';
  const mapped = live || input.temporal.mode === 'forecast';

  return {
    id: `observation-${capturedAt}-${Math.random().toString(36).slice(2, 8)}`,
    capturedAt,
    weatherReceipt: { state: weatherState, sourceTime: weatherAvailable ? atmosphere?.sourceTime ?? null : null, fetchedAt: weatherAvailable ? atmosphere?.fetchedAt ?? null : null, attribution: weatherAvailable ? atmosphere?.attribution ?? null : null },
    region: input.region,
    coordinate: {
      latitude: input.latitude,
      longitude: input.longitude
    },
    temporal: {
      ...input.temporal,
      range: input.temporal.range ? { ...input.temporal.range } : null,
      scenarioVisual: input.temporal.scenarioVisual
        ? { ...input.temporal.scenarioVisual }
        : null
    },
    useCase: input.useCase,
    visualMode: input.visualMode,
    selectedEntity: input.selection
      ? {
          id: input.selection.id,
          canonicalId:
            input.selection.identity?.canonicalId ?? input.selection.id,
          identityBasis:
            input.selection.identity?.basis ?? 'scene-derived',
          sourceFeatureId:
            input.selection.identity?.sourceFeatureId ?? null,
          gersId: input.selection.identity?.gersId ?? null,
          crossSourceJoinReady:
            input.selection.identity?.crossSourceJoinReady ?? false,
          kind: input.selection.kind,
          source: input.selection.source ?? null,
          layerId:
            input.selection.identity?.layerId ??
            (typeof input.selection.properties?.layerId === 'string'
              ? input.selection.properties.layerId
              : null)
        }
      : null,
    measurement: input.measurement
      ? {
          distanceMeters: input.measurement.distanceMeters,
          bearingDegrees: input.measurement.bearingDegrees,
          elevationDeltaMeters: input.measurement.elevationDeltaMeters,
          precision: input.measurement.precision
        }
      : null,
    metrics: {
      buildingCount: mapped ? finite(input.cityIdentity?.buildingCount) : null,
      skylineMaxHeightM: mapped ? finite(input.cityIdentity?.maxHeightM) : null,
      skylineP95HeightM: mapped ? finite(input.cityIdentity?.p95HeightM) : null,
      temperatureC: weatherAvailable && weatherState !== 'unavailable' ? finite(atmosphere?.current?.temperatureC) : null,
      windSpeedKph: weatherAvailable && weatherState !== 'unavailable' ? finite(atmosphere?.current?.windSpeedKph) : null,
      usAqi: live ? finite(input.liveContext?.airQuality.current?.usAqi) : null,
      pm25UgM3: live ? finite(input.liveContext?.airQuality.current?.pm25UgM3) : null,
      seismicEventCount: live ? finite(input.liveContext?.seismic.eventCount) : null,
      maxMagnitude: live ? finite(input.liveContext?.seismic.maxMagnitude) : null,
      nearestSeismicKm: live
        ? finite(input.liveContext?.seismic.nearestDistanceKm)
        : null
    },
    provenance: {
      cityProvider: input.cityIdentity?.sourceProvider ?? null,
      citySourceTime: input.cityIdentity?.upstreamTimestamp ?? null,
      environmentAttribution: input.atmosphere?.attribution ?? null,
      environmentSourceTime: weatherAvailable ? input.atmosphere?.sourceTime ?? null : null,
      airQualityProvider: live
        ? input.liveContext?.airQuality.source.provider ?? null
        : null,
      airQualitySourceTime: live
        ? input.liveContext?.airQuality.source.modelTime ?? null
        : null,
      seismicProvider: live
        ? input.liveContext?.seismic.source.provider ?? null
        : null,
      seismicFetchedAt: live
        ? input.liveContext?.seismic.source.fetchedAt ?? null
        : null
    }
  };
}

const METRICS: readonly {
  key: keyof SpatialObservation['metrics'];
  label: string;
  unit: string;
}[] = [
  { key: 'buildingCount', label: 'BUILDINGS', unit: '' },
  { key: 'skylineMaxHeightM', label: 'SKYLINE MAX', unit: 'm' },
  { key: 'skylineP95HeightM', label: 'SKYLINE P95', unit: 'm' },
  { key: 'temperatureC', label: 'TEMPERATURE', unit: '°C' },
  { key: 'windSpeedKph', label: 'WIND', unit: 'km/h' },
  { key: 'usAqi', label: 'US AQI', unit: '' },
  { key: 'pm25UgM3', label: 'PM2.5', unit: 'µg/m³' },
  { key: 'seismicEventCount', label: 'SEISMIC EVENTS', unit: '' },
  { key: 'maxMagnitude', label: 'MAX MAGNITUDE', unit: 'M' },
  { key: 'nearestSeismicKm', label: 'NEAREST SEISMIC', unit: 'km' }
] as const;

export function compareSpatialObservations(
  a: SpatialObservation,
  b: SpatialObservation
): SpatialComparison {
  const metricDeltas = METRICS.flatMap((metric) => {
    const aValue = a.metrics[metric.key];
    const bValue = b.metrics[metric.key];
    if (aValue == null || bValue == null) return [];
    const weather = metric.key === 'temperatureC' || metric.key === 'windSpeedKph';
    const geometry = ['buildingCount', 'skylineMaxHeightM', 'skylineP95HeightM'].includes(metric.key);
    const aState = a.weatherReceipt?.state, bState = b.weatherReceipt?.state;
    const basis: SpatialMetricDelta['basis'] = geometry ? 'mapped-context' : weather
      ? aState !== bState ? 'mixed-source-states' : aState === 'live' ? 'measured' : aState === 'forecast' ? 'forecast' : 'unverified'
      : 'unverified';
    return [
      {
        ...metric,
        basis,
        a: aValue,
        b: bValue,
        delta: bValue - aValue
      }
    ];
  });

  const capturedSeparationSeconds =
    Math.abs(Date.parse(b.capturedAt) - Date.parse(a.capturedAt)) / 1000;
  const frameSeparationSeconds =
    Math.abs(Date.parse(b.temporal.iso) - Date.parse(a.temporal.iso)) / 1000;

  const sameCanonicalEntity =
    a.selectedEntity?.canonicalId && b.selectedEntity?.canonicalId
      ? a.selectedEntity.canonicalId === b.selectedEntity.canonicalId
      : null;

  return {
    a,
    b,
    capturedSeparationSeconds:
      Number.isFinite(capturedSeparationSeconds) ? capturedSeparationSeconds : 0,
    frameSeparationSeconds:
      Number.isFinite(frameSeparationSeconds) ? frameSeparationSeconds : 0,
    sameCanonicalEntity,
    metricDeltas
  };
}

export function downloadSpatialComparison(comparison: SpatialComparison): void {
  const payload = {
    schemaVersion: 'aethergrid.operator-spatial-comparison.v2',
    kind: 'operator-spatial-comparison',
    authoritative: false,
    generatedAt: new Date().toISOString(),
    note:
      'Operator analysis assembled from captured source-backed and modeled context. This package is not a substitute for the server evidence ledger.',
    comparison
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aethergrid-spatial-comparison-${payload.generatedAt
    .replaceAll(':', '-')
    .replaceAll('.', '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
