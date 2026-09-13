import { fingerprintDecisionReceipt } from '../decision-receipt.mjs';
import { createSpatialScene, routeSpatialScene } from './holographic_contracts.mjs';

export function planGridScene({
  snapshotId,
  decisionReceipt,
  nodes = [],
  targets = [],
  targetId,
} = {}) {
  if (typeof snapshotId !== 'string' || !snapshotId.trim()) {
    throw new TypeError('snapshotId is required.');
  }
  if (!decisionReceipt || typeof decisionReceipt !== 'object' || Array.isArray(decisionReceipt)) {
    throw new TypeError('decisionReceipt is required.');
  }
  if (decisionReceipt.snapshotId !== snapshotId.trim()) {
    throw new TypeError('decisionReceipt snapshotId must match snapshotId.');
  }
  if (!Array.isArray(nodes)) throw new TypeError('nodes must be an array.');
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new TypeError('At least one holographic target is required.');
  }

  const decisionReceiptFingerprint = fingerprintDecisionReceipt(decisionReceipt);
  const scene = createSpatialScene({
    id: `grid-scene-${snapshotId.trim()}`,
    source: 'thergrid',
    provenance: {
      snapshotId: snapshotId.trim(),
      decisionReceiptFingerprint,
    },
    nodes,
    targets,
  });

  const selectedTarget = targetId ?? scene.targets[0].id;
  const route = routeSpatialScene(scene, selectedTarget);
  return Object.freeze({
    scene,
    route,
    provenance: scene.provenance,
    sourceOfTruth: 'grid-state',
  });
}
