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
    expect(negotiateSpatialScene(scene, 'projector-1')).toMatchObject({ compatible: true, missing: [] });
    expect(negotiateSpatialScene(scene, 'mat-1')).toMatchObject({ compatible: false, missing: ['depth'] });
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
    expect(batch).toMatchObject({ status: 'partial', targetCount: 2, successCount: 1, failureCount: 1 });
    expect(batch.receipts.map((receipt) => receipt.status)).toEqual(['simulated', 'failed']);
  });
});
