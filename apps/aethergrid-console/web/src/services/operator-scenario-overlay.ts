import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';
import type { TemporalInstant } from '../renderer/spatial-renderer';
import type { OperatorScenario } from './operator-scenario';
import type { ScenarioVisualState } from './scenario-client';
import type { SpatialWorksetGeometrySummary } from './spatial-workset-geometry';

export function buildOperatorScenarioOverlay(
  scenario: OperatorScenario,
  geometry: SpatialWorksetGeometrySummary,
  temporal: TemporalInstant,
  visual: ScenarioVisualState,
): SpatialOverlaySnapshot {
  const intensity = Math.min(
    1,
    Math.max(0.2, 0.35 + (visual.stressFactor - 0.65) / 1.7 + visual.weatherRisk * 0.2),
  );
  const byId = new Map(geometry.nodes.map((node) => [node.canonicalId, node]));

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
        heightMeters: node.heightMeters + 36,
      },
      label: `${scenario.name} · ${node.displayName}`,
      intensity,
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
        sourceDataset: 'local-operator-scenario',
      },
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
            heightMeters: from.heightMeters + 36,
          },
          to: {
            latitude: to.latitude,
            longitude: to.longitude,
            heightMeters: to.heightMeters + 36,
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
            sourceDataset: 'local-operator-scenario',
          },
        },
      ];
    }),
    areas: [],
  };
}
