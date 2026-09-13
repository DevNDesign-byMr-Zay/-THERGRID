import { createHash } from 'node:crypto';

export const SPATIAL_SCENE_SCHEMA = 'thergrid.spatial-scene.v1';
const TARGET_TYPES = new Set(['projector', 'holomat', 'three-d-platform']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function normalizeProvenance(provenance) {
  if (provenance == null) return null;
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) throw new TypeError('Scene provenance must be an object.');
  const snapshotId = typeof provenance.snapshotId === 'string' ? provenance.snapshotId.trim() : '';
  if (!snapshotId) throw new TypeError('Scene provenance snapshotId is required.');
  const fingerprint = typeof provenance.decisionReceiptFingerprint === 'string' ? provenance.decisionReceiptFingerprint.trim() : '';
  if (!SHA256_PATTERN.test(fingerprint)) throw new TypeError('Scene provenance requires a SHA-256 decision receipt fingerprint.');
  return Object.freeze({ snapshotId, decisionReceiptFingerprint: fingerprint });
}

function hash(payload) { return createHash('sha256').update(JSON.stringify(payload)).digest('hex'); }
function replayKey(scene, target) { return hash({ schema: scene.schema, id: scene.id, source: scene.source, provenance: scene.provenance ?? null, nodes: scene.nodes, target }); }
function requiredCapabilities(scene) { return [...new Set(scene.nodes.flatMap((node) => node.data?.requires ?? []).map(String))]; }

export function createHolographicTarget({ id, type, capabilities = [], simulated = true } = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Target id is required.');
  if (!TARGET_TYPES.has(type)) throw new TypeError(`Unsupported target type: ${type}`);
  if (!Array.isArray(capabilities)) throw new TypeError('Target capabilities must be an array.');
  return Object.freeze({ id: id.trim(), type, capabilities: Object.freeze([...new Set(capabilities.map(String))]), simulated: Boolean(simulated) });
}

export function createSpatialScene({ id, source = 'thergrid', provenance = null, nodes = [], targets = [] } = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Scene id is required.');
  if (!Array.isArray(nodes) || !Array.isArray(targets)) throw new TypeError('Scene nodes and targets must be arrays.');
  return Object.freeze({
    schema: SPATIAL_SCENE_SCHEMA, id: id.trim(), source, provenance: normalizeProvenance(provenance),
    nodes: Object.freeze(nodes.map((node, index) => Object.freeze({ id: String(node.id ?? `node-${index + 1}`), kind: node.kind ?? 'grid-state', position: Object.freeze({ x: node.position?.x ?? 0, y: node.position?.y ?? 0, z: node.position?.z ?? 0 }), data: Object.freeze({ ...(node.data ?? {}) }) }))),
    targets: Object.freeze(targets.map(createHolographicTarget)),
  });
}

export function routeSpatialScene(scene, targetId) {
  const target = scene.targets.find((candidate) => candidate.id === targetId);
  if (!target) throw new Error(`Unknown holographic target: ${targetId}`);
  return Object.freeze({ sceneId: scene.id, targetId: target.id, type: target.type, status: 'ready' });
}

export function negotiateSpatialScene(scene, targetId) {
  const target = scene.targets.find((candidate) => candidate.id === targetId);
  if (!target) throw new Error(`Unknown holographic target: ${targetId}`);
  const required = requiredCapabilities(scene);
  const missing = required.filter((capability) => !target.capabilities.includes(capability));
  return Object.freeze({ targetId: target.id, targetType: target.type, compatible: missing.length === 0, missing });
}

export function executeSpatialScene(scene, targetId, { executionId } = {}) {
  const route = routeSpatialScene(scene, targetId);
  const target = scene.targets.find((candidate) => candidate.id === targetId);
  const compatibility = negotiateSpatialScene(scene, targetId);
  if (!compatibility.compatible) throw new Error(`Target ${targetId} is missing capabilities: ${compatibility.missing.join(', ')}`);
  if (target.simulated !== true) throw new Error('Live spatial execution is not enabled.');
  return Object.freeze({ executionId: executionId ?? `${scene.id}:${targetId}`, replayKey: replayKey(scene, target), sceneId: route.sceneId, targetId: route.targetId, targetType: route.type, status: 'simulated', simulated: true, nodeCount: scene.nodes.length, compatibility, ...(scene.provenance ? { provenance: scene.provenance } : {}), sourceOfTruth: 'grid-state' });
}

export function executeSpatialSceneBatch(scene, targetIds = [], { executionId } = {}) {
  if (!Array.isArray(targetIds) || targetIds.length === 0) throw new TypeError('at least one target id is required.');
  const uniqueTargetIds = [...new Set(targetIds.map((id) => String(id).trim()))];
  if (uniqueTargetIds.some((id) => !id)) throw new TypeError('target ids must be non-empty strings.');
  const receipts = uniqueTargetIds.map((targetId) => {
    try { return executeSpatialScene(scene, targetId); }
    catch (error) {
      const target = scene.targets.find((candidate) => candidate.id === targetId);
      const compatibility = target ? negotiateSpatialScene(scene, targetId) : null;
      return Object.freeze({ sceneId: scene.id, targetId, targetType: target?.type ?? null, status: 'failed', simulated: target?.simulated === true, error: error.message, compatibility });
    }
  });
  const failures = receipts.filter((receipt) => receipt.status === 'failed');
  const batchKey = hash({ schema: SPATIAL_SCENE_SCHEMA, sceneId: scene.id, targetResults: receipts.map((receipt) => ({ targetId: receipt.targetId, replayKey: receipt.replayKey ?? null, status: receipt.status, compatibility: receipt.compatibility })) });
  const status = failures.length === 0 ? 'simulated' : failures.length === receipts.length ? 'failed' : 'partial';
  return Object.freeze({ executionId: executionId ?? `${scene.id}:batch`, batchKey, sceneId: scene.id, status, simulated: failures.length === 0 || receipts.some((receipt) => receipt.simulated), targetCount: receipts.length, successCount: receipts.length - failures.length, failureCount: failures.length, receipts: Object.freeze(receipts), ...(scene.provenance ? { provenance: scene.provenance } : {}), sourceOfTruth: 'grid-state' });
}
