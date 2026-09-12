import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createHolographicTarget,
  createSpatialScene,
  executeSpatialScene,
  routeSpatialScene,
} from '../../src/spatial/holographic_contracts.mjs';

describe('THERGRID holographic contracts', () => {
  test('creates supported display targets', () => {
    assert.equal(createHolographicTarget({ id: 'mat-1', type: 'holomat' }).simulated, true);
  });

  test('creates spatial scenes without changing grid truth', () => {
    const scene = createSpatialScene({
      id: 'grid-demo',
      nodes: [{ id: 'solar', position: { x: 1 } }],
      targets: [{ id: 'proj-1', type: 'projector' }],
    });
    assert.equal(scene.schema, 'thergrid.spatial-scene.v1');
    assert.deepEqual(scene.nodes[0].position, { x: 1, y: 0, z: 0 });
  });

  test('routes scenes to explicit targets', () => {
    const scene = createSpatialScene({
      id: 'grid-demo',
      targets: [{ id: 'platform-1', type: 'three-d-platform' }],
    });
    assert.deepEqual(routeSpatialScene(scene, 'platform-1'), {
      sceneId: 'grid-demo',
      targetId: 'platform-1',
      type: 'three-d-platform',
      status: 'ready',
    });
  });

  test('returns an auditable holographic execution receipt for simulated targets', () => {
    const scene = createSpatialScene({
      id: 'grid-demo',
      nodes: [{ id: 'solar' }],
      targets: [{ id: 'proj-1', type: 'projector' }],
    });
    assert.deepEqual(executeSpatialScene(scene, 'proj-1', { executionId: 'exec-1' }), {
      executionId: 'exec-1',
      sceneId: 'grid-demo',
      targetId: 'proj-1',
      targetType: 'projector',
      status: 'simulated',
      simulated: true,
      nodeCount: 1,
      sourceOfTruth: 'grid-state',
    });
  });

  test('fails closed when a target is marked for live execution', () => {
    const scene = createSpatialScene({
      id: 'grid-demo',
      targets: [{ id: 'live-proj', type: 'projector', simulated: false }],
    });

    assert.throws(
      () => executeSpatialScene(scene, 'live-proj'),
      /Live spatial execution is not enabled/,
    );
  });
});
