import { createHash } from 'node:crypto';

const RENDERER_CONTRACT_VERSION = 2;
const TARGETS = new Set(['holo-mat', 'projector', 'volumetric-3d', 'ar-vr', 'web-dashboard']);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function checksum(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

/**
 * Convert a renderer-neutral scene and negotiated presentation plan into a
 * deterministic render packet. This is the final software boundary before a
 * renderer integration; it contains no driver calls or physical side effects.
 * Evidence identity is carried into the packet so downstream renderers cannot
 * silently detach a visual artifact from the experiment that produced it.
 */
export function compileHolographicRenderPacket({ scene, presentation, experimentId = null, receiptId = null } = {}) {
  const spatialScene = object(scene, 'scene');
  const plan = object(presentation, 'presentation');
  if (spatialScene.sceneVersion !== 2) throw new TypeError('scene.sceneVersion must equal 2');
  if (plan.schemaVersion !== 1) throw new TypeError('presentation.schemaVersion must equal 1');
  if (plan.sceneId !== spatialScene.sceneId) throw new TypeError('presentation.sceneId must match scene.sceneId');
  if (plan.target != null && !TARGETS.has(text(plan.target, 'presentation.target'))) throw new TypeError(`unsupported render target: ${plan.target}`);
  if (plan.status === 'ready-for-renderer' && !plan.deviceId) throw new TypeError('ready-for-renderer presentation requires a deviceId');
  if (experimentId != null) text(experimentId, 'experimentId');
  if (receiptId != null) text(receiptId, 'receiptId');

  const payload = {
    contractVersion: RENDERER_CONTRACT_VERSION,
    sceneId: text(spatialScene.sceneId, 'scene.sceneId'),
    snapshotId: text(spatialScene.snapshotId, 'scene.snapshotId'),
    experimentId,
    receiptId,
    target: plan.target,
    deviceId: plan.deviceId,
    status: plan.status,
    coordinateSystem: text(spatialScene.coordinateSystem, 'scene.coordinateSystem'),
    layers: spatialScene.layers,
    nodes: Array.isArray(spatialScene.nodes) ? spatialScene.nodes : [],
    metrics: spatialScene.metrics ?? null,
    provenanceRef: spatialScene.provenanceRef ?? null,
    safety: { authoritative: false, actuatesHardware: false, advisoryOnly: true },
  };

  return Object.freeze({ ...payload, checksum: checksum(payload) });
}

export function validateHolographicRenderPacket(packet) {
  try {
    const value = object(packet, 'packet');
    if (value.contractVersion !== RENDERER_CONTRACT_VERSION) return false;
    if (typeof value.sceneId !== 'string' || !value.sceneId.trim()) return false;
    if (value.target != null && !TARGETS.has(value.target)) return false;
    if (value.experimentId != null && (typeof value.experimentId !== 'string' || !value.experimentId.trim())) return false;
    if (value.receiptId != null && (typeof value.receiptId !== 'string' || !value.receiptId.trim())) return false;
    if (typeof value.checksum !== 'string' || value.checksum.length !== 64) return false;
    if (value.safety?.authoritative !== false || value.safety?.actuatesHardware !== false || value.safety?.advisoryOnly !== true) return false;
    const { checksum: supplied, ...body } = value;
    return checksum(body) === supplied;
  } catch {
    return false;
  }
}

export { RENDERER_CONTRACT_VERSION };
