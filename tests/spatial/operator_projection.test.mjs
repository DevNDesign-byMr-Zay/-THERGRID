import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSpatialScene,
  executeSpatialSceneBatch,
} from '../../src/spatial/holographic_contracts.mjs';
import {
  buildOperatorProjection,
  OPERATOR_PROJECTION_SCHEMA,
} from '../../src/spatial/operator_projection.mjs';

function sceneFor(fingerprint = 'a'.repeat(64)) {
  return createSpatialScene({
    id: 'grid-scene-snapshot-operator',
    provenance: {
      snapshotId: 'snapshot-operator',
      decisionReceiptFingerprint: fingerprint,
    },
    nodes: [
      {
        id: 'battery',
        kind: 'storage',
        data: { stateOfChargePct: 62, requires: ['depth'] },
      },
    ],
    targets: [
      { id: 'projector-1', type: 'projector', capabilities: ['depth'] },
      { id: 'mat-limited', type: 'holomat', capabilities: [] },
    ],
  });
}

test('builds a read-only operator projection from receipt-backed partial execution', () => {
  const scene = sceneFor();
  const batch = executeSpatialSceneBatch(scene, ['projector-1', 'mat-limited']);
  const projection = buildOperatorProjection({ scene, executionBatch: batch });

  assert.equal(projection.schema, OPERATOR_PROJECTION_SCHEMA);
  assert.equal(projection.status, 'partial');
  assert.equal(projection.advisoryOnly, true);
  assert.equal(projection.actuationEnabled, false);
  assert.equal(projection.sourceOfTruth, 'grid-state');
  assert.deepEqual(projection.provenance, scene.provenance);
  assert.deepEqual(
    projection.targets.map(({ targetId, status, compatible, missing }) => ({
      targetId,
      status,
      compatible,
      missing,
    })),
    [
      { targetId: 'projector-1', status: 'simulated', compatible: true, missing: [] },
      { targetId: 'mat-limited', status: 'failed', compatible: false, missing: ['depth'] },
    ],
  );
  assert.equal(projection.entities[0].id, 'battery');
  assert.match(projection.projectionKey, /^[a-f0-9]{64}$/);
  assert(Object.isFrozen(projection));
  assert(Object.isFrozen(projection.targets));
});

test('keeps projection identity deterministic and bound to decision provenance', () => {
  const firstScene = sceneFor('a'.repeat(64));
  const firstBatch = executeSpatialSceneBatch(firstScene, ['projector-1']);
  const first = buildOperatorProjection({ scene: firstScene, executionBatch: firstBatch });
  const repeated = buildOperatorProjection({ scene: firstScene, executionBatch: firstBatch });

  const secondScene = sceneFor('b'.repeat(64));
  const secondBatch = executeSpatialSceneBatch(secondScene, ['projector-1']);
  const second = buildOperatorProjection({ scene: secondScene, executionBatch: secondBatch });

  assert.equal(first.projectionKey, repeated.projectionKey);
  assert.notEqual(first.projectionKey, second.projectionKey);
});

test('fails closed when operator evidence is not receipt-backed or provenance does not match', () => {
  const unbackedScene = createSpatialScene({
    id: 'unbacked',
    nodes: [],
    targets: [{ id: 'projector-1', type: 'projector' }],
  });
  const unbackedBatch = executeSpatialSceneBatch(unbackedScene, ['projector-1']);
  assert.throws(
    () => buildOperatorProjection({ scene: unbackedScene, executionBatch: unbackedBatch }),
    /receipt-backed scene provenance/,
  );

  const scene = sceneFor();
  const batch = executeSpatialSceneBatch(scene, ['projector-1']);
  const mismatchedBatch = {
    ...batch,
    provenance: {
      snapshotId: scene.provenance.snapshotId,
      decisionReceiptFingerprint: 'c'.repeat(64),
    },
  };
  assert.throws(
    () => buildOperatorProjection({ scene, executionBatch: mismatchedBatch }),
    /provenance must match/,
  );
});
