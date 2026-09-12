import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSpatialScene,
  executeSpatialScene,
} from '../../src/spatial/holographic_contracts.mjs';

const firstFingerprint = 'a'.repeat(64);
const secondFingerprint = 'b'.repeat(64);

function sceneFor(decisionReceiptFingerprint) {
  return createSpatialScene({
    id: 'grid-scene-snapshot-100',
    provenance: {
      snapshotId: 'snapshot-100',
      decisionReceiptFingerprint,
    },
    nodes: [{ id: 'battery', data: { stateOfChargePct: 62 } }],
    targets: [{ id: 'mat-1', type: 'holomat' }],
  });
}

test('carries audited snapshot provenance into simulated spatial receipts', () => {
  const receipt = executeSpatialScene(sceneFor(firstFingerprint), 'mat-1');

  assert.deepEqual(receipt.provenance, {
    snapshotId: 'snapshot-100',
    decisionReceiptFingerprint: firstFingerprint,
  });
  assert(Object.isFrozen(receipt.provenance));
});

test('changes replay identity when the audited decision receipt changes', () => {
  const first = executeSpatialScene(sceneFor(firstFingerprint), 'mat-1');
  const second = executeSpatialScene(sceneFor(secondFingerprint), 'mat-1');

  assert.notEqual(first.replayKey, second.replayKey);
  assert.match(first.replayKey, /^[a-f0-9]{64}$/);
  assert.match(second.replayKey, /^[a-f0-9]{64}$/);
});

test('rejects malformed decision receipt fingerprints at the scene boundary', () => {
  assert.throws(
    () =>
      createSpatialScene({
        id: 'grid-scene-invalid',
        provenance: {
          snapshotId: 'snapshot-invalid',
          decisionReceiptFingerprint: 'not-a-fingerprint',
        },
      }),
    /SHA-256 decision receipt fingerprint/,
  );
});
