import { createHash } from 'node:crypto';

import { SPATIAL_SCENE_SCHEMA } from './holographic_contracts.mjs';

export const OPERATOR_PROJECTION_SCHEMA = 'thergrid.operator-projection.v1';

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requireReceiptBackedScene(scene) {
  if (!scene || scene.schema !== SPATIAL_SCENE_SCHEMA) {
    throw new TypeError('A spatial scene is required.');
  }
  if (!scene.provenance) {
    throw new TypeError('Operator projection requires receipt-backed scene provenance.');
  }
  return scene;
}

function requireExecutionBatch(scene, executionBatch) {
  if (!executionBatch || typeof executionBatch !== 'object' || Array.isArray(executionBatch)) {
    throw new TypeError('An execution batch receipt is required.');
  }
  if (executionBatch.sceneId !== scene.id) {
    throw new TypeError('Execution batch sceneId must match the spatial scene.');
  }
  if (
    !executionBatch.provenance ||
    executionBatch.provenance.snapshotId !== scene.provenance.snapshotId ||
    executionBatch.provenance.decisionReceiptFingerprint !==
      scene.provenance.decisionReceiptFingerprint
  ) {
    throw new TypeError('Execution batch provenance must match the spatial scene.');
  }
  if (!Array.isArray(executionBatch.receipts)) {
    throw new TypeError('Execution batch target receipts are required.');
  }
  return executionBatch;
}

export function buildOperatorProjection({ scene, executionBatch } = {}) {
  const normalizedScene = requireReceiptBackedScene(scene);
  const batch = requireExecutionBatch(normalizedScene, executionBatch);

  const targets = Object.freeze(
    batch.receipts.map((receipt) =>
      Object.freeze({
        targetId: receipt.targetId,
        targetType: receipt.targetType,
        status: receipt.status,
        compatible: receipt.compatibility?.compatible === true,
        missing: Object.freeze([...(receipt.compatibility?.missing ?? [])]),
      }),
    ),
  );

  const entities = Object.freeze(
    normalizedScene.nodes.map((node) =>
      Object.freeze({
        id: node.id,
        kind: node.kind,
        position: node.position,
        data: node.data,
      }),
    ),
  );

  const payload = {
    schema: OPERATOR_PROJECTION_SCHEMA,
    sceneId: normalizedScene.id,
    provenance: normalizedScene.provenance,
    status: batch.status,
    advisoryOnly: true,
    actuationEnabled: false,
    targets,
    entities,
    sourceOfTruth: 'grid-state',
  };

  return Object.freeze({
    ...payload,
    projectionKey: hash(payload),
  });
}
