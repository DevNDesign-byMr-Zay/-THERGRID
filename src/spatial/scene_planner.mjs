import { createSpatialScene, routeSpatialScene } from './holographic_contracts.mjs';

export function planGridScene({ snapshotId, nodes = [], targets = [], targetId } = {}) {
  if (typeof snapshotId !== 'string' || !snapshotId.trim()) throw new TypeError('snapshotId is required.');
  if (!Array.isArray(nodes)) throw new TypeError('nodes must be an array.');
  if (!Array.isArray(targets) || targets.length === 0) throw new TypeError('At least one holographic target is required.');

  const scene = createSpatialScene({
    id: `grid-scene-${snapshotId}`,
    source: 'thergrid',
    nodes,
    targets,
  });

  const selectedTarget = targetId ?? scene.targets[0].id;
  const route = routeSpatialScene(scene, selectedTarget);
  return Object.freeze({ scene, route, sourceOfTruth: 'grid-state' });
}
