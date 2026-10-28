import assert from 'node:assert/strict';
import test from 'node:test';

import { CITY_USE_CASES } from '../apps/aethergrid-console/analysis/city-use-cases.mjs';
import { cityMeshMetrics } from '../apps/aethergrid-console/analysis/city-metrics.mjs';
import { analyzeCityUseCase } from '../apps/aethergrid-console/analysis/city-planning.mjs';
import {
  CITY_USE_CASES as serverCases,
  cityMeshMetrics as serverMetrics,
  analyzeCityUseCase as serverAnalyze,
} from '../apps/aethergrid-console/server.mjs';

const mesh = {
  city: { id: 'fixture-city', name: 'Fixture City', radiusM: 1000 },
  source: { provider: 'local-fixture', live: false },
  buildings: [
    {
      heightM: 12,
      levels: 4,
      footprint: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
    },
  ],
  roads: [
    {
      path: [
        [0, 0],
        [300, 400],
      ],
      highwayType: 'primary',
    },
  ],
  powerLines: [
    {
      path: [
        [0, 0],
        [0, 1000],
      ],
      voltage: 138000,
    },
  ],
  powerAssets: [{ powerType: 'substation' }],
  terrain: { minElevationM: 10, maxElevationM: 42 },
};

test('extracted city metrics are pure and keep the existing server API contract', () => {
  assert.equal(serverMetrics, cityMeshMetrics);
  assert.equal(serverCases, CITY_USE_CASES);
  assert.equal(serverAnalyze, analyzeCityUseCase);

  const metrics = cityMeshMetrics(mesh);
  assert.equal(metrics.buildingCount, 1);
  assert.equal(metrics.footprintAreaM2, 100);
  assert.equal(metrics.estimatedFloorAreaM2, 400);
  assert.equal(metrics.primaryRoadKm, 0.5);
  assert.equal(metrics.highVoltageKm, 1);
  assert.equal(metrics.substations, 1);
  assert.equal(metrics.terrainReliefM, 32);
});

test('extracted city planning stays advisory and validates unsupported operations', () => {
  const output = analyzeCityUseCase(mesh, 'grid-resilience');
  assert.equal(output.schemaVersion, 4);
  assert.equal(output.advisoryOnly, true);
  assert.equal(output.planningIndex.value >= 0 && output.planningIndex.value <= 100, true);
  assert.equal(output.dataQuality.liveGeometry, false);
  assert.match(output.dataQuality.limitations, /not operational ground truth/u);
  assert.throws(() => analyzeCityUseCase(mesh, 'unknown'), { status: 400 });
  assert.throws(() => analyzeCityUseCase(null, 'grid-resilience'), { status: 409 });
});
