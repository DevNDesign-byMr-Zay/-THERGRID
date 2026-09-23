const DEVICE_TYPES = new Set(['holo-mat', 'projector', 'volumetric-3d', 'ar-vr', 'web-dashboard']);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function capabilities(value) {
  if (!Array.isArray(value) || value.length === 0)
    throw new TypeError('capabilities must contain at least one capability');
  return [...new Set(value.map((item, index) => text(item, `capabilities[${index}]`)))].sort();
}

/**
 * Create a renderer-neutral holographic device descriptor.
 * Descriptors describe presentation capability only; they never authorize actuation.
 */
export function createHolographicDeviceDescriptor(input) {
  const device = object(input, 'device');
  const type = text(device.type, 'device.type');
  if (!DEVICE_TYPES.has(type)) throw new TypeError(`unsupported holographic device type: ${type}`);

  return Object.freeze({
    schemaVersion: 1,
    id: text(device.id, 'device.id'),
    type,
    capabilities: capabilities(device.capabilities),
    online: device.online === true,
    authoritative: false,
  });
}

/**
 * Select the first online device capable of rendering the requested target.
 * Device order is caller-controlled so selection is deterministic and testable.
 */
export function selectCompatibleDevice(devices, target) {
  if (!Array.isArray(devices)) throw new TypeError('devices must be an array');
  const requestedTarget = text(target, 'target');
  return (
    devices
      .map((device) => createHolographicDeviceDescriptor(device))
      .find((device) => device.online && device.type === requestedTarget) ?? null
  );
}

/**
 * Build a safe presentation plan from a renderer-neutral spatial scene.
 * The result intentionally stops before physical actuation.
 */
export function planHolographicPresentation({ scene, devices, preferredTarget = null } = {}) {
  const spatialScene = object(scene, 'scene');
  if (spatialScene.sceneVersion !== 2) throw new TypeError('scene.sceneVersion must equal 2');
  const renderer = object(spatialScene.rendererContract, 'scene.rendererContract');
  const supportedTargets = capabilities(renderer.supportedTargets);
  const candidates = Array.isArray(devices) ? devices : [];
  const target =
    preferredTarget == null
      ? (supportedTargets.find((candidate) => selectCompatibleDevice(candidates, candidate)) ??
        null)
      : text(preferredTarget, 'preferredTarget');

  if (target != null && !supportedTargets.includes(target)) {
    throw new TypeError(`target is not supported by the scene: ${target}`);
  }

  const device = target == null ? null : selectCompatibleDevice(candidates, target);
  return Object.freeze({
    schemaVersion: 1,
    sceneId: text(spatialScene.sceneId, 'scene.sceneId'),
    target,
    deviceId: device?.id ?? null,
    status: device ? 'ready-for-renderer' : 'no-compatible-device',
    authoritative: false,
    actuatesHardware: false,
  });
}

export { DEVICE_TYPES };
