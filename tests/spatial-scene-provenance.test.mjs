import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { buildSpatialScene } from '../src/spatial-scene.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'snapshot-scene-provenance-001',
  observedAt: '2026-09-16T00:00:00.000Z',
  assets: [
    { id: 'solar-1', kind: 'solar', powerKw: 12, capacityKw: 15 },
    { id: 'load-1', kind: 'load', powerKw: 10, flexible: true },
    {
      id: 'grid-1',
      kind: 'grid_interconnect',
      powerKw: -2,
      importLimitKw: 80,
      exportLimitKw: 40,
    },
  ],
  topology: {
    nodes: ['node-a'],
    connections: [
      { assetId: 'solar-1', nodeId: 'node-a' },
      { assetId: 'load-1', nodeId: 'node-a' },
      { assetId: 'grid-1', nodeId: 'node-a' },
    ],
  },
};

test('pipeline scene preserves experiment, snapshot, and receipt provenance identity', () => {
  const run = runSyntheticMicrogrid(snapshot);

  assert.deepEqual(run.scene.provenanceRef, {
    experimentId: run.experimentId,
    snapshotId: snapshot.snapshotId,
    receiptId: run.receipt.receiptId,
  });
  assert.equal(Object.isFrozen(run.scene.provenanceRef), true);
  assert.deepEqual(run.renderPacket.provenanceRef, run.scene.provenanceRef);
});

test('scene provenance must remain bound to the twin snapshot', () => {
  const run = runSyntheticMicrogrid(snapshot);

  assert.throws(
    () =>
      buildSpatialScene({
        twinState: run.twinState,
        proposal: run.proposal,
        provenance: {
          experimentId: run.experimentId,
          snapshotId: 'different-snapshot',
          receiptId: run.receipt.receiptId,
        },
      }),
    /provenance\.snapshotId must match twinState\.snapshotId/,
  );
});

test('scene provenance getters are rejected without evaluation', () => {
  const run = runSyntheticMicrogrid(snapshot);
  let getterReads = 0;
  const provenance = {
    snapshotId: snapshot.snapshotId,
    receiptId: run.receipt.receiptId,
  };
  Object.defineProperty(provenance, 'experimentId', {
    enumerable: true,
    get() {
      getterReads += 1;
      return run.experimentId;
    },
  });

  assert.throws(
    () =>
      buildSpatialScene({
        twinState: run.twinState,
        proposal: run.proposal,
        provenance,
      }),
    /provenance\.experimentId must not use accessors/,
  );
  assert.equal(getterReads, 0);
});
