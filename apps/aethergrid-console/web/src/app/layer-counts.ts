import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';

type CountedOverlay = Pick<SpatialOverlaySnapshot, 'nodes' | 'edges'>;

export interface LayerCountInputs {
  semanticOverlays: readonly SpatialOverlaySnapshot[];
  globalLive?: {
    overlay: Pick<SpatialOverlaySnapshot, 'nodes'>;
    earthquakeCount?: number;
  } | null;
  scope: 'world' | 'city';
  cityIdentity?: { buildingCount?: number } | null;
  atmosphere?: { current?: unknown } | null;
  liveContext?: {
    airQuality: { current?: { usAqi?: number | null } | null };
    seismic: { eventCount?: number };
  } | null;
  temporalMode: string;
  windOverlay?: CountedOverlay | null;
  aviationOverlay?: CountedOverlay | null;
  hazardOverlay?: CountedOverlay | null;
  transitOverlay?: CountedOverlay | null;
  hydrologyOverlay?: CountedOverlay | null;
  powerOverlay?: CountedOverlay | null;
  spatialIncidents: readonly unknown[];
  worksetGeometry: { positionedEntityCount: number; edgeCount: number };
  operatorScenarioOverlay?: CountedOverlay | null;
}

export function computeLayerCounts({
  semanticOverlays,
  globalLive,
  scope,
  cityIdentity,
  atmosphere,
  liveContext,
  temporalMode,
  windOverlay,
  aviationOverlay,
  hazardOverlay,
  transitOverlay,
  hydrologyOverlay,
  powerOverlay,
  spatialIncidents,
  worksetGeometry,
  operatorScenarioOverlay
}: LayerCountInputs): Record<string, number> {
    const semantic = new Map(semanticOverlays.map((snapshot) => [snapshot.layerId, snapshot]));
    const countOverlay = (id: string) => {
      const snapshot = semantic.get(id);
      if (!snapshot) return 0;
      return (
        snapshot.nodes.length +
        snapshot.edges.length +
        (snapshot.areas?.length ?? 0)
      );
    };

    return {
      world: globalLive?.overlay.nodes.length ?? 0,
      terrain: scope === 'city' ? 1 : 0,
      buildings: scope === 'city' ? cityIdentity?.buildingCount ?? 0 : 0,
      roads: scope === 'city' ? countOverlay('roads') : 0,
      water: scope === 'city' ? countOverlay('water') : 0,
      green: scope === 'city' ? countOverlay('green') : 0,
      grid: 1,
      weather:
        scope === 'city' && temporalMode === 'live'
          ? (windOverlay?.edges.length ?? (atmosphere?.current ? 1 : 0))
          : 0,
      air:
        scope === 'city' &&
        temporalMode === 'live' &&
        liveContext?.airQuality.current?.usAqi != null
          ? 1
          : 0,
      aviation:
        temporalMode === 'live' && aviationOverlay
          ? aviationOverlay.nodes.length + aviationOverlay.edges.length
          : 0,
      seismic:
        temporalMode !== 'live'
          ? 0
          : scope === 'world'
            ? globalLive?.earthquakeCount ?? 0
            : liveContext?.seismic.eventCount ?? 0,
      hazards:
        scope === 'city' && temporalMode === 'live' && hazardOverlay
          ? hazardOverlay.nodes.length + hazardOverlay.edges.length
          : 0,
      transit:
        scope === 'city' && temporalMode === 'live' && transitOverlay
          ? transitOverlay.nodes.length + transitOverlay.edges.length
          : 0,
      hydrology:
        scope === 'city' && temporalMode === 'live' && hydrologyOverlay
          ? hydrologyOverlay.nodes.length + hydrologyOverlay.edges.length
          : 0,
      energy:
        scope === 'city' && powerOverlay
          ? powerOverlay.nodes.length + powerOverlay.edges.length
          : 0,
      annotations: spatialIncidents.length,
      'workset-analysis':
        worksetGeometry.positionedEntityCount + worksetGeometry.edgeCount,
      'scenario-model': operatorScenarioOverlay
        ? operatorScenarioOverlay.nodes.length +
          operatorScenarioOverlay.edges.length
        : 0
    } as Record<string, number>;
}
