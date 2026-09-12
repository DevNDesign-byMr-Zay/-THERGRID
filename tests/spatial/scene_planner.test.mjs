import test from 'node:test';
import assert from 'node:assert/strict';
import { createHolographicTarget } from '../../src/spatial/holographic_contracts.mjs';
import { planGridScene } from '../../src/spatial/scene_planner.mjs';

test('plans a spatial scene from a grid snapshot without mutating grid truth', () => {
  const projector = createHolographicTarget({ id: 'projector-1', type: 'projector', capabilities: ['depth'] });
  const result = planGridScene({
    snapshotId: 'snapshot-001',
    nodes: [{ id: 'solar-1', position: { x: 1, y: 0, z: 2 }, data: { outputKw: 12 } }],
    targets: [projector],
  });

  assert.equal(result.scene.schema, 'thergrid.spatial-scene.v1');
  assert.equal(result.scene.nodes[0].data.outputKw, 12);
  assert.equal(result.route.targetId, 'projector-1');
  assert.equal(result.sourceOfTruth, 'grid-state');
});

test('routes explicitly selected holographic targets', () => {
  const targets = [
    createHolographicTarget({ id: 'mat-1', type: 'holomat' }),
    createHolographicTarget({ id: 'platform-1', type: 'three-d-platform' }),
  ];
  const result = planGridScene({ snapshotId: 'snapshot-002', targets, targetId: 'platform-1' });

  assert.equal(result.route.type, 'three-d-platform');
});
