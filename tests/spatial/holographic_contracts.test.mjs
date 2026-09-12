import { createHolographicTarget, createSpatialScene, routeSpatialScene } from '../../src/spatial/holographic_contracts.mjs';

describe('THERGRID holographic contracts', () => {
  test('creates supported display targets', () => {
    expect(createHolographicTarget({ id: 'mat-1', type: 'holomat' }).simulated).toBe(true);
  });

  test('creates spatial scenes without changing grid truth', () => {
    const scene = createSpatialScene({ id: 'grid-demo', nodes: [{ id: 'solar', position: { x: 1 } }], targets: [{ id: 'proj-1', type: 'projector' }] });
    expect(scene.schema).toBe('thergrid.spatial-scene.v1');
    expect(scene.nodes[0].position).toEqual({ x: 1, y: 0, z: 0 });
  });

  test('routes scenes to explicit targets', () => {
    const scene = createSpatialScene({ id: 'grid-demo', targets: [{ id: 'platform-1', type: 'three-d-platform' }] });
    expect(routeSpatialScene(scene, 'platform-1')).toEqual({ sceneId: 'grid-demo', targetId: 'platform-1', type: 'three-d-platform', status: 'ready' });
  });
});
