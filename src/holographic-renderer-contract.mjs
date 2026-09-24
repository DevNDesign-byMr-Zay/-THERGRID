import { createHash } from 'node:crypto';

const RENDERER_CONTRACT_VERSION = 3;
const TARGETS = new Set(['holo-mat', 'projector', 'volumetric-3d', 'ar-vr', 'web-dashboard']);
const COMPILE_INPUT_KEYS = Object.freeze([
  'scene',
  'presentation',
  'experimentId',
  'receiptId',
  'operatorAttentionFingerprint',
]);
const PACKET_KEYS = Object.freeze([
  'contractVersion',
  'sceneId',
  'snapshotId',
  'experimentId',
  'receiptId',
  'operatorAttentionFingerprint',
  'target',
  'deviceId',
  'status',
  'coordinateSystem',
  'layers',
  'nodes',
  'metrics',
  'evidence',
  'provenanceRef',
  'safety',
  'checksum',
]);
const SAFETY_KEYS = Object.freeze(['authoritative', 'actuatesHardware', 'advisoryOnly']);

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function snapshotEvidence(value, path = 'evidence', seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} numbers must be finite`);
    return value;
  }
  if (!value || typeof value !== 'object') {
    throw new TypeError(`${path} must contain JSON-compatible evidence`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} must not contain symbol properties`);
  }
  if (seen.has(value)) throw new TypeError(`${path} must not contain circular references`);
  seen.add(value);

  let copy;
  if (Array.isArray(value)) {
    const allowedKeys = new Set(['length']);
    copy = [];
    for (let index = 0; index < value.length; index += 1) {
      const key = String(index);
      allowedKeys.add(key);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) throw new TypeError(`${path} must not contain sparse arrays`);
      if ('get' in descriptor || 'set' in descriptor) {
        throw new TypeError(`${path}[${index}] must not use accessors`);
      }
      copy.push(snapshotEvidence(descriptor.value, `${path}[${index}]`, seen));
    }
    if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowedKeys.has(key))) {
      throw new TypeError(`${path} arrays must not contain extra properties`);
    }
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError(`${path} must be a plain object`);
    }
    copy = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable) throw new TypeError(`${path}.${key} must be enumerable evidence`);
      if ('get' in descriptor || 'set' in descriptor) {
        throw new TypeError(`${path}.${key} must not use accessors`);
      }
      Object.defineProperty(copy, key, {
        value: snapshotEvidence(descriptor.value, `${path}.${key}`, seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }

  seen.delete(value);
  return copy;
}

function readCompileInput(value) {
  const copy = snapshotEvidence(value, 'render input');
  const keys = Object.keys(copy);
  const unexpected = keys.find((key) => !COMPILE_INPUT_KEYS.includes(key));
  if (unexpected) throw new TypeError(`render input contains unsupported field: ${unexpected}`);
  for (const key of ['scene', 'presentation']) {
    if (!Object.hasOwn(copy, key)) throw new TypeError(`render input requires ${key}`);
  }
  return copy;
}

function hasExactKeys(value, expected) {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function checksum(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

/**
 * Convert a renderer-neutral scene and negotiated presentation plan into a
 * deterministic render packet. This is the final software boundary before a
 * renderer integration; it contains no driver calls or physical side effects.
 * Evidence identity and operator attention are carried into the packet so
 * downstream renderers cannot silently detach a visual artifact from its
 * decision review context.
 */
export function compileHolographicRenderPacket(input = {}) {
  const values = readCompileInput(input);
  const spatialScene = values.scene;
  const plan = values.presentation;
  const experimentId = Object.hasOwn(values, 'experimentId') ? values.experimentId : null;
  const receiptId = Object.hasOwn(values, 'receiptId') ? values.receiptId : null;
  const operatorAttentionFingerprint = Object.hasOwn(values, 'operatorAttentionFingerprint')
    ? values.operatorAttentionFingerprint
    : null;

  if (spatialScene.sceneVersion !== 2) throw new TypeError('scene.sceneVersion must equal 2');
  if (plan.schemaVersion !== 1) throw new TypeError('presentation.schemaVersion must equal 1');
  if (plan.sceneId !== spatialScene.sceneId) {
    throw new TypeError('presentation.sceneId must match scene.sceneId');
  }
  if (plan.target != null && !TARGETS.has(text(plan.target, 'presentation.target'))) {
    throw new TypeError(`unsupported render target: ${plan.target}`);
  }
  if (plan.status === 'ready-for-renderer' && !plan.deviceId) {
    throw new TypeError('ready-for-renderer presentation requires a deviceId');
  }
  if (experimentId != null) text(experimentId, 'experimentId');
  if (receiptId != null) text(receiptId, 'receiptId');
  if (
    operatorAttentionFingerprint != null &&
    !/^[a-f0-9]{64}$/.test(operatorAttentionFingerprint)
  ) {
    throw new TypeError('operatorAttentionFingerprint must be a SHA-256 fingerprint');
  }

  const payload = {
    contractVersion: RENDERER_CONTRACT_VERSION,
    sceneId: text(spatialScene.sceneId, 'scene.sceneId'),
    snapshotId: text(spatialScene.snapshotId, 'scene.snapshotId'),
    experimentId,
    receiptId,
    operatorAttentionFingerprint,
    target: plan.target,
    deviceId: plan.deviceId,
    status: plan.status,
    coordinateSystem: text(spatialScene.coordinateSystem, 'scene.coordinateSystem'),
    layers: spatialScene.layers,
    nodes: Array.isArray(spatialScene.nodes) ? spatialScene.nodes : [],
    metrics: spatialScene.metrics ?? null,
    evidence: spatialScene.evidence ?? {
      powerFlows: [],
      forecastDelta: null,
      simulation: null,
    },
    provenanceRef: spatialScene.provenanceRef ?? null,
    safety: { authoritative: false, actuatesHardware: false, advisoryOnly: true },
  };

  return deepFreeze({ ...payload, checksum: checksum(payload) });
}

export function validateHolographicRenderPacket(packet) {
  try {
    const value = snapshotEvidence(packet, 'packet');
    if (!hasExactKeys(value, PACKET_KEYS)) return false;
    if (value.contractVersion !== RENDERER_CONTRACT_VERSION) return false;
    if (typeof value.sceneId !== 'string' || !value.sceneId.trim()) return false;
    if (typeof value.snapshotId !== 'string' || !value.snapshotId.trim()) return false;
    if (value.target != null && !TARGETS.has(value.target)) return false;
    if (
      value.experimentId != null &&
      (typeof value.experimentId !== 'string' || !value.experimentId.trim())
    ) {
      return false;
    }
    if (
      value.receiptId != null &&
      (typeof value.receiptId !== 'string' || !value.receiptId.trim())
    ) {
      return false;
    }
    if (
      value.operatorAttentionFingerprint != null &&
      !/^[a-f0-9]{64}$/.test(value.operatorAttentionFingerprint)
    ) {
      return false;
    }
    if (!Array.isArray(value.nodes)) return false;
    if (!value.evidence || typeof value.evidence !== 'object' || Array.isArray(value.evidence)) {
      return false;
    }
    if (!Array.isArray(value.evidence.powerFlows)) return false;
    if (typeof value.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(value.checksum)) {
      return false;
    }
    if (!hasExactKeys(value.safety, SAFETY_KEYS)) return false;
    if (
      value.safety.authoritative !== false ||
      value.safety.actuatesHardware !== false ||
      value.safety.advisoryOnly !== true
    ) {
      return false;
    }
    const { checksum: supplied, ...body } = value;
    return checksum(body) === supplied;
  } catch {
    return false;
  }
}

export { RENDERER_CONTRACT_VERSION };
