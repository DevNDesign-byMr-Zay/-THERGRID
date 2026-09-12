import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpatialScene,
  createHolographicTarget,
  executeSpatialSceneBatch,
  negotiateSpatialScene,
} from '../../src/spatial/holographic_contracts.mjs';

describe('THERGRID holographic batch policy', () => {
  test('negotiates required capabilities per target', () => {
    const scene = createSpatialScene({
      id: 'capability-scene',
      nodes: [{ id: 'hero', data: { requires: ['depth'] } }],
      targets: [
        createHolographicTarget({ id: 'projector-1', type: 'projector', capabilities: ['depth'] }),
        createHolographicTarget({ id: 'mat-1', type: 'holomat', capabilities: [] }),
      ],
    });
    assert.deepEqual(negotiateSpatialScene(scene, 'projector-1'), { targetId: 'projector-1', targetType: 'projector', compatible: true, missing: [] });
    assert.deepEqual(negotiateSpatialScene(scene, 'mat-1'), { targetId: 'mat-1', targetType: 'holomat', compatible: false, missing: ['depth'] });
  });

  test('returns partial status instead of failing the entire batch', () => {
    const scene = createSpatialScene({
      id: 'partial-scene',
      nodes: [{ id: 'hero', data: { requires: ['depth'] } }],
      targets: [
        createHolographicTarget({ id: 'projector-1', type: 'projector', capabilities: ['depth'] }),
        createHolographicTarget({ id: 'mat-1', type: 'holomat', capabilities: [] }),
      ],
    });
    const batch = executeSpatialSceneBatch(scene, ['projector-1', 'mat-1']);
    assert.deepEqual({ status: batch.status, targetCount: batch.targetCount, successCount: batch.successCount, failureCount: batch.failureCount }, { status: 'partial', targetCount: 2, successCount: 1, failureCount: 1 });
    assert.deepEqual(batch.receipts.map((receipt) => receipt.status), ['simulated', 'failed']);
  });
});
