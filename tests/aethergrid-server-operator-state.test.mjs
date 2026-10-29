import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSpatialGraph,
  regions,
  scenarios,
  state,
  views,
} from '../apps/aethergrid-console/operator-state.mjs';

test('operator defaults are advisory and cannot silently actuate infrastructure', () => {
  assert.equal(state.system.mode, 'ADVISORY ONLY');
  assert.equal(state.system.physicalActuation, false);
  assert.equal(state.system.infrastructureDispatch, false);
  assert.equal(state.system.scenario, 'peak-demand');
  assert.deepEqual(views, ['live', 'forecast', 'scenario']);
  assert.ok(regions.includes('New York Metro'));
  assert.ok(scenarios.includes('custom'));
});

test('initial spatial graph has deterministic 4D topology and bounded city structures', () => {
  const graph = buildSpatialGraph();
  assert.deepEqual(graph, buildSpatialGraph());
  assert.notEqual(graph, buildSpatialGraph());
  assert.equal(graph.schemaVersion, 1);
  assert.deepEqual(graph.dimensions, ['x', 'y', 'z', 'time']);
  assert.equal(graph.coordinateSystem, 'normalized-operator-grid');
  assert.deepEqual(graph.temporal, { minHour: 0, maxHour: 24, unit: 'hour' });
  assert.equal(graph.nodes.length, 7);
  assert.equal(graph.routes.length, 9);
  assert.equal(graph.structures.length, 72);
  const ids = new Set(graph.nodes.map((node) => node.id));
  assert.equal(ids.size, graph.nodes.length);
  for (const route of graph.routes) {
    assert.ok(ids.has(route.from));
    assert.ok(ids.has(route.to));
    assert.ok(route.capacityMw > 0);
  }
  for (const structure of graph.structures) {
    for (const key of ['x', 'z', 'width', 'depth', 'height', 'temporalPhase']) {
      assert.ok(Number.isFinite(structure[key]));
    }
  }
});
