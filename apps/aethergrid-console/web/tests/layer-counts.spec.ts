import { expect, test } from '@playwright/test';
import { computeLayerCounts } from '../src/app/layer-counts';
import type { SpatialOverlaySnapshot } from '../src/renderer/overlays/spatial-overlay';

function overlay(
  layerId: string,
  nodes = 0,
  edges = 0,
  areas = 0
): SpatialOverlaySnapshot {
  return {
    layerId,
    nodes: Array(nodes).fill(null),
    edges: Array(edges).fill(null),
    areas: Array(areas).fill(null)
  } as unknown as SpatialOverlaySnapshot;
}

function baseline(scope: 'world' | 'city' = 'city', temporalMode = 'live') {
  return {
    scope,
    temporalMode,
    semanticOverlays: [
      overlay('roads', 0, 7),
      overlay('water', 0, 3, 2),
      overlay('green', 0, 0, 4)
    ],
    spatialIncidents: [{ id: 'local-annotation' }],
    worksetGeometry: { positionedEntityCount: 2, edgeCount: 3 }
  };
}

test('city counts distinguish observed overlay geometry from local annotations', () => {
  const counts = computeLayerCounts({
    ...baseline(),
    globalLive: { overlay: overlay('world', 6), earthquakeCount: 5 },
    cityIdentity: { buildingCount: 340 },
    liveContext: {
      airQuality: { current: { usAqi: 55 } },
      seismic: { eventCount: 2 }
    },
    windOverlay: overlay('wind', 0, 12),
    hazardOverlay: overlay('hazards', 3, 4),
    transitOverlay: overlay('transit', 9, 0),
    hydrologyOverlay: overlay('hydrology', 2, 1),
    powerOverlay: overlay('energy', 8, 11),
    operatorScenarioOverlay: overlay('scenario', 2, 3)
  });
  expect(counts).toMatchObject({
    world: 6,
    buildings: 340,
    roads: 7,
    water: 5,
    green: 4,
    weather: 12,
    air: 1,
    seismic: 2,
    hazards: 7,
    transit: 9,
    hydrology: 3,
    energy: 19,
    annotations: 1,
    'workset-analysis': 5,
    'scenario-model': 5
  });
});

test('non-live frames do not present live hazards, transit or weather as available', () => {
  const common = {
    ...baseline('city', 'historical'),
    cityIdentity: { buildingCount: 10 },
    liveContext: {
      airQuality: { current: { usAqi: 80 } },
      seismic: { eventCount: 8 }
    },
    atmosphere: { current: { summary: 'out-of-frame' } },
    windOverlay: overlay('wind', 0, 6),
    hazardOverlay: overlay('hazards', 1, 2),
    transitOverlay: overlay('transit', 2, 0),
    hydrologyOverlay: overlay('hydrology', 2, 1),
    aviationOverlay: overlay('aviation', 10, 3)
  };
  const counts = computeLayerCounts(common);
  for (const key of ['weather', 'air', 'seismic', 'hazards', 'transit', 'hydrology', 'aviation']) {
    expect(counts[key]).toBe(0);
  }
  expect(counts.buildings).toBe(10);
  expect(counts.annotations).toBe(1);
});

test('world presentation hides city-only counts while keeping global seismic context', () => {
  const counts = computeLayerCounts({
    ...baseline('world'),
    globalLive: { overlay: overlay('world', 8), earthquakeCount: 4 },
    cityIdentity: { buildingCount: 200 },
    powerOverlay: overlay('energy', 15, 4)
  });
  expect(counts.world).toBe(8);
  expect(counts.seismic).toBe(4);
  expect(counts.buildings).toBe(0);
  expect(counts.energy).toBe(0);
  expect(counts.roads).toBe(0);
});

test('aviation counts update when new live vehicle snapshots arrive', () => {
  const first = computeLayerCounts({
    ...baseline(),
    aviationOverlay: overlay('aviation', 3, 2)
  });
  const refreshed = computeLayerCounts({
    ...baseline(),
    aviationOverlay: overlay('aviation', 1, 0)
  });
  expect(first.aviation).toBe(5);
  expect(refreshed.aviation).toBe(1);
});
