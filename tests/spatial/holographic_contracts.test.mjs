import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createHolographicTarget, createSpatialScene, executeSpatialScene, executeSpatialSceneBatch, routeSpatialScene } from '../../src/spatial/holographic_contracts.mjs';

describe('THERGRID holographic contracts', () => {
  test('creates supported display targets', () => assert.equal(createHolographicTarget({ id: 'mat-1', type: 'holomat' }).simulated, true));

  test('creates spatial scenes without changing grid truth', () => {
    const scene = createSpatialScene({ id: 'grid-demo', nodes: [{ id: 'solar', position: { x: 1 } }], targets: [{ id: 'proj-1', type: 'projector' }] });
    assert.equal(scene.schema, 'thergrid.spatial-scene.v1');
    assert.deepEqual(scene.nodes[0].position, { x: 1, y: 0, z: 0 });
  });

  test('routes scenes to explicit targets', () => {
    const scene = createSpatialScene({ id: 'grid-demo', targets: [{ id: 'platform-1', type: 'three-d-platform' }] });
    assert.deepEqual(routeSpatialScene(scene, 'platform-1'), { sceneId: 'grid-demo', targetId: 'platform-1', type: 'three-d-platform', status: 'ready' });
  });

  test('returns deterministic target replay evidence independent of execution id', () => {
    const scene = createSpatialScene({ id: 'grid-demo', nodes: [{ id: 'solar' }], targets: [{ id: 'proj-1', type: 'projector' }, { id: 'proj-2', type: 'projector' }] });
    const first = executeSpatialScene(scene, 'proj-1', { executionId: 'exec-1' });
    const second = executeSpatialScene(scene, 'proj-1', { executionId: 'exec-2' });
    assert.equal(first.replayKey, second.replayKey);
    assert.match(first.replayKey, /^[a-f0-9]{64}$/);
    assert.notEqual(first.replayKey, executeSpatialScene(scene, 'proj-2').replayKey);
  });

  test('returns an auditable holographic execution receipt', () => {
    const scene = createSpatialScene({ id: 'grid-demo', nodes: [{ id: 'solar' }], targets: [{ id: 'proj-1', type: 'projector' }] });
    const receipt = executeSpatialScene(scene, 'proj-1', { executionId: 'exec-1' });
    assert.equal(receipt.status, 'simulated');
    assert.equal(receipt.sourceOfTruth, 'grid-state');
    assert.equal(receipt.nodeCount, 1);
  });

  test('executes multiple targets with stable batch evidence', () => {
    const scene = createSpatialScene({ id: 'grid-demo', nodes: [{ id: 'solar' }], targets: [{ id: 'proj-1', type: 'projector' }, { id: 'mat-1', type: 'holomat' }] });
    const first = executeSpatialSceneBatch(scene, ['proj-1', 'mat-1', 'proj-1'], { executionId: 'batch-1' });
    const second = executeSpatialSceneBatch(scene, ['proj-1', 'mat-1'], { executionId: 'batch-2' });
    assert.equal(first.targetCount, 2);
    assert.equal(first.receipts.length, 2);
    assert.equal(first.batchKey, second.batchKey);
    assert.match(first.batchKey, /^[a-f0-9]{64}$/);
  });

  test('rejects empty or malformed batch requests', () => {
    const scene = createSpatialScene({ id: 'grid-demo', targets: [{ id: 'proj-1', type: 'projector' }] });
    assert.throws(() => executeSpatialSceneBatch(scene), /at least one target id/);
    assert.throws(() => executeSpatialSceneBatch(scene, ['']), /target ids/);
  });

  test('fails closed when a target is marked for live execution', () => {
    const scene = createSpatialScene({ id: 'grid-demo', targets: [{ id: 'live-proj', type: 'projector', simulated: false }] });
    assert.throws(() => executeSpatialScene(scene, 'live-proj'), /Live spatial execution is not enabled/);
  });
});
