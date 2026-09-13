import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDecisionReceipt } from '../../src/decision-receipt.mjs';
import { createHolographicTarget } from '../../src/spatial/holographic_contracts.mjs';
import { planGridScene } from '../../src/spatial/scene_planner.mjs';

function decisionReceipt(snapshotId) {
  return buildDecisionReceipt({
    twinState: {
      snapshotId,
      observedAt: '2026-09-12T20:00:00.000Z',
    },
    forecast: {
      snapshotId,
      forecastFor: '2026-09-12T20:15:00.000Z',
      method: 'persistence-v1',
      horizonMinutes: 15,
      generationKw: 124,
      loadKw: 117,
    },
    proposal: {
      snapshotId,
      forecastFor: '2026-09-12T20:15:00.000Z',
      strategy: 'balance-via-grid-v1',
      projectedBalanceKw: 7,
      action: {
        kind: 'grid-adjustment',
        adjustmentKw: -7,
        targetKw: 15,
      },
      advisoryOnly: true,
    },
  });
}

test('plans a receipt-backed spatial scene without mutating grid truth', () => {
  const projector = createHolographicTarget({
    id: 'projector-1',
    type: 'projector',
    capabilities: ['depth'],
  });
  const result = planGridScene({
    snapshotId: 'snapshot-001',
    decisionReceipt: decisionReceipt('snapshot-001'),
    nodes: [{ id: 'solar-1', position: { x: 1, y: 0, z: 2 }, data: { outputKw: 12 } }],
    targets: [projector],
  });

  assert.equal(result.scene.schema, 'thergrid.spatial-scene.v1');
  assert.equal(result.scene.nodes[0].data.outputKw, 12);
  assert.equal(result.route.targetId, 'projector-1');
  assert.equal(result.provenance.snapshotId, 'snapshot-001');
  assert.match(result.provenance.decisionReceiptFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(result.scene.provenance, result.provenance);
  assert.equal(result.sourceOfTruth, 'grid-state');
});

test('routes explicitly selected holographic targets', () => {
  const targets = [
    createHolographicTarget({ id: 'mat-1', type: 'holomat' }),
    createHolographicTarget({ id: 'platform-1', type: 'three-d-platform' }),
  ];
  const result = planGridScene({
    snapshotId: 'snapshot-002',
    decisionReceipt: decisionReceipt('snapshot-002'),
    targets,
    targetId: 'platform-1',
  });

  assert.equal(result.route.type, 'three-d-platform');
});

test('fails closed when spatial provenance does not match the snapshot', () => {
  const targets = [createHolographicTarget({ id: 'mat-1', type: 'holomat' })];

  assert.throws(
    () =>
      planGridScene({
        snapshotId: 'snapshot-003',
        decisionReceipt: decisionReceipt('snapshot-other'),
        targets,
      }),
    /decisionReceipt snapshotId must match snapshotId/,
  );
});

test('requires a decision receipt before a grid scene can be planned', () => {
  const targets = [createHolographicTarget({ id: 'mat-1', type: 'holomat' })];

  assert.throws(
    () => planGridScene({ snapshotId: 'snapshot-004', targets }),
    /decisionReceipt is required/,
  );
});
