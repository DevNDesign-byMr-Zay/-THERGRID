export const SPATIAL_SCENE_SCHEMA = 'thergrid.spatial-scene.v1';

export function createHolographicTarget({ id, type, capabilities = [], simulated = true } = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Target id is required.');
  if (!['projector', 'holomat', 'three-d-platform'].includes(type)) throw new TypeError(`Unsupported target type: ${type}`);
  return Object.freeze({ id, type, capabilities: Object.freeze([...new Set(capabilities)]), simulated: Boolean(simulated) });
}

export function createSpatialScene({ id, source = 'thergrid', nodes = [], targets = [] } = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Scene id is required.');
  return Object.freeze({
    schema: SPATIAL_SCENE_SCHEMA,
    id,
    source,
    nodes: Object.freeze(nodes.map((node) => Object.freeze({
      id: node.id,
      kind: node.kind ?? 'grid-state',
      position: Object.freeze({ x: node.position?.x ?? 0, y: node.position?.y ?? 0, z: node.position?.z ?? 0 }),
      data: Object.freeze({ ...(node.data ?? {}) }),
    }))),
    targets: Object.freeze(targets.map(createHolographicTarget)),
  });
}

export function routeSpatialScene(scene, targetId) {
  const target = scene.targets.find((candidate) => candidate.id === targetId);
  if (!target) throw new Error(`Unknown holographic target: ${targetId}`);
  return Object.freeze({ sceneId: scene.id, targetId: target.id, type: target.type, status: 'ready' });
}
