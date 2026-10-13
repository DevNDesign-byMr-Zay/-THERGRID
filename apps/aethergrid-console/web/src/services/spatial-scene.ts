import type { LayerState, SpatialCameraSnapshot, SpatialFeatureSelection, SpatialTarget, TemporalInstant, VisualMode } from '../renderer/spatial-renderer';
import type { OperatorScenario } from './operator-scenario';
import type { SpatialAreaMeasurement } from './spatial-area';
import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';

export interface SpatialSceneInput {
  target: SpatialTarget;
  camera: SpatialCameraSnapshot | null;
  visualMode: VisualMode;
  layers: readonly LayerState[];
  temporal: TemporalInstant;
  selection: SpatialFeatureSelection | null;
  datasets: readonly { sourceId?: string; role: string; state: string; provider: string | null; dataset: string | null; sourceTime: string | null; fetchedAt: string | null; attribution: string | null }[];
  scenario: OperatorScenario | null;
  area?: SpatialAreaMeasurement | null;
}
const finite = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function overlaySceneReceipts(overlays: readonly SpatialOverlaySnapshot[]): SpatialSceneInput['datasets'] {
  return overlays.map(overlay => {
    const modeled = ['analysis','workset-analysis','scenario-model','illumination'].includes(overlay.layerId);
    const mapped = ['buildings','energy','roads','water','green'].includes(overlay.layerId);
    return { sourceId: overlay.id, role: overlay.layerId, state: modeled ? 'modeled' : overlay.stale ? 'stale' : overlay.fallback ? 'simulated' : mapped ? 'mapped' : overlay.live ? 'live' : 'unknown',
      provider: null, dataset: overlay.layerId, sourceTime: modeled ? null : overlay.sourceTime, fetchedAt: modeled ? null : overlay.fetchedAt, attribution: overlay.attribution ?? null };
  });
}
function target(value: SpatialTarget) {
  return { id: value.id ?? null, latitude: value.latitude, longitude: value.longitude, heightMeters: finite(value.heightMeters),
    rangeMeters: finite(value.rangeMeters), headingDegrees: finite(value.headingDegrees), pitchDegrees: finite(value.pitchDegrees) };
}
function camera(value: SpatialCameraSnapshot | null) {
  if (!value || ![value.latitude,value.longitude,value.heightMeters,value.headingDegrees,value.pitchDegrees,value.rollDegrees].every(Number.isFinite) ||
    Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180 || !['geocentric','local-projected'].includes(value.projection)) return null;
  return { projection: value.projection, latitude: value.latitude, longitude: value.longitude, heightMeters: value.heightMeters,
    headingDegrees: value.headingDegrees, pitchDegrees: value.pitchDegrees, rollDegrees: value.rollDegrees, target: value.target ? target(value.target) : null };
}

export function buildSpatialSceneDescription(input: SpatialSceneInput) {
  const viewCamera = camera(input.camera);
  const scenario = input.temporal.mode === 'scenario' && input.scenario?.id === input.temporal.scenarioId ? input.scenario : null;
  return {
    schemaVersion: 'aethergrid.spatial-scene.v1' as const,
    authoritative: false as const,
    exportedAt: new Date().toISOString(),
    target: target(input.target), camera: viewCamera, presentation: input.visualMode,
    layers: input.layers.map(layer => ({ id: layer.id, visible: layer.visible === true, opacity: Math.max(0, Math.min(1, finite(layer.opacity) ?? 1)) })),
    frame: { iso: input.temporal.iso, mode: input.temporal.mode, sourceTime: input.temporal.sourceTime ?? null,
      liveReferenceIso: input.temporal.liveReferenceIso ?? null, scenarioId: input.temporal.scenarioId ?? null,
      range: input.temporal.range ? { start: input.temporal.range.start, end: input.temporal.range.end } : null },
    selection: input.selection ? { sceneId: input.selection.id, canonicalId: input.selection.identity?.canonicalId ?? null,
      sourceFeatureId: input.selection.identity?.sourceFeatureId ?? null, kind: input.selection.kind, source: input.selection.source ?? null } : null,
    sources: input.datasets.map(source => ({ sourceId: source.sourceId ?? null, role: source.role, state: source.state, provider: source.provider,
      dataset: source.dataset, sourceTime: source.sourceTime, fetchedAt: source.fetchedAt, attribution: source.attribution })),
    modeledEffects: scenario ? { id: scenario.id, name: scenario.name, modeled: true as const, authoritative: false as const,
      startIso: scenario.startIso, endIso: scenario.endIso ?? null,
      parameters: { loadMultiplierPercent: scenario.parameters.loadMultiplierPercent, renewableAvailabilityPercent: scenario.parameters.renewableAvailabilityPercent,
        storageReservePercent: scenario.parameters.storageReservePercent, weatherRiskPercent: scenario.parameters.weatherRiskPercent },
      assumptions: scenario.assumptions.map(assumption => ({ id: assumption.id, text: assumption.text, createdAt: assumption.createdAt })) } : null,
    modeledPresentation: input.temporal.mode === 'scenario' && input.temporal.scenarioVisual ? {
      stressFactor: finite(input.temporal.scenarioVisual.stressFactor), renewableBias: finite(input.temporal.scenarioVisual.renewableBias),
      storageStress: finite(input.temporal.scenarioVisual.storageStress), weatherRisk: finite(input.temporal.scenarioVisual.weatherRisk), authoritative: false as const
    } : null,
    measurement: input.area ? { approximation: input.area.approximation, areaSquareMeters: input.area.areaSquareMeters,
      perimeterMeters: input.area.perimeterMeters, points: input.area.points.map(point => ({ latitude: point.latitude, longitude: point.longitude, heightMeters: finite(point.heightMeters ?? undefined), source: point.source })) } : null,
    limitations: [
      'Operator scene description; source receipts do not establish surveyed geometry or per-building electrical flow.',
      'Current mapped topology is not historical reconstruction; missing observations remain unavailable.',
      'Source frames require revalidation when reopened; modeled effects are not real observations.',
      ...(!viewCamera ? ['Camera snapshot unavailable from the active renderer.'] : viewCamera.projection === 'local-projected' ? ['Native camera records projected view parameters, not terrain or photorealistic geometry.'] : []),
      ...(input.area ? ['Area is a local horizontal approximation, not terrain surface area.'] : [])
    ]
  };
}
export type SpatialSceneDescription = ReturnType<typeof buildSpatialSceneDescription>;

export function downloadSpatialScene(input: SpatialSceneInput): void {
  const payload = buildSpatialSceneDescription(input);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `aethergrid-scene-${payload.exportedAt.replaceAll(':','-')}.json`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
