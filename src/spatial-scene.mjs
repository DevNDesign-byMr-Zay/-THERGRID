import { createHash } from 'node:crypto';

const SCENE_VERSION = 2;

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}
function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}
function id(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}
function sceneId(snapshotId) {
  return `scene-${createHash('sha256').update(`thergrid-scene-v${SCENE_VERSION}:${snapshotId}`, 'utf8').digest('hex').slice(0, 16)}`;
}

function readOwnData(value, key, path) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!descriptor.enumerable) throw new TypeError(`${path}.${key} must be enumerable data`);
  if ('get' in descriptor || 'set' in descriptor) {
    throw new TypeError(`${path}.${key} must not use accessors`);
  }
  return descriptor.value;
}

function buildSceneProvenanceRef(provenance, expectedSnapshotId) {
  if (provenance == null) return null;
  const value = requireObject(provenance, 'provenance');
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError('provenance must not contain symbol properties');
  }

  const experimentId = id(readOwnData(value, 'experimentId', 'provenance'), 'provenance.experimentId');
  const snapshotId = id(readOwnData(value, 'snapshotId', 'provenance'), 'provenance.snapshotId');
  if (snapshotId !== expectedSnapshotId) {
    throw new TypeError('provenance.snapshotId must match twinState.snapshotId');
  }
  const receiptValue = readOwnData(value, 'receiptId', 'provenance');
  const receiptId = receiptValue == null ? null : id(receiptValue, 'provenance.receiptId');

  return Object.freeze({ experimentId, snapshotId, receiptId });
}

export function getSpatialSceneId(snapshotId) {
  return sceneId(id(snapshotId, 'snapshotId'));
}

export function buildSpatialScene({
  twinState,
  proposal = null,
  alerts = [],
  provenance = null,
  attention = [],
} = {}) {
  const twin = requireObject(twinState, 'twinState');
  const totals = requireObject(twin.totals, 'twinState.totals');
  finite(totals.generationKw, 'twinState.totals.generationKw');
  finite(totals.loadKw, 'twinState.totals.loadKw');
  finite(totals.balanceKw, 'twinState.totals.balanceKw');
  if (!Array.isArray(alerts)) throw new TypeError('alerts must be an array');
  if (!Array.isArray(attention)) throw new TypeError('attention must be an array');

  const snapshotId = id(twin.snapshotId, 'twinState.snapshotId');
  const provenanceRef = buildSceneProvenanceRef(provenance, snapshotId);

  return {
    sceneVersion: SCENE_VERSION,
    sceneId: sceneId(snapshotId),
    snapshotId,
    observedAt: id(twin.observedAt, 'twinState.observedAt'),
    coordinateSystem: 'thergrid-logical-grid-v1',
    rendererContract: {
      mode: 'renderer-neutral',
      supportedTargets: ['holo-mat', 'projector', 'volumetric-3d', 'ar-vr', 'web-dashboard'],
      authoritativeSource: 'thergrid-decision-receipt',
    },
    nodes: [],
    layers: {
      topology: true,
      powerFlows: true,
      forecastDelta: true,
      simulationEvidence: true,
      alerts: alerts.map((alert, index) => ({
        id: id(alert.id ?? `alert-${index}`, `alerts[${index}].id`),
        severity: id(alert.severity ?? 'info', `alerts[${index}].severity`),
        message: id(alert.message ?? 'Unspecified alert', `alerts[${index}].message`),
      })),
      attention: attention.map((item, index) => ({
        id: id(item.id ?? `attention-${index}`, `attention[${index}].id`),
        priority: finite(item.priority ?? index, `attention[${index}].priority`),
        severity: id(item.severity ?? 'info', `attention[${index}].severity`),
        reason: id(item.reason ?? 'Unspecified', `attention[${index}].reason`),
        evidenceRef:
          item.evidenceRef == null
            ? null
            : id(item.evidenceRef, `attention[${index}].evidenceRef`),
        advisoryOnly: true,
      })),
      provenance: Boolean(provenanceRef),
    },
    metrics: {
      generationKw: totals.generationKw,
      loadKw: totals.loadKw,
      balanceKw: totals.balanceKw,
      renewableSharePercent: totals.renewableSharePercent ?? null,
    },
    provenanceRef,
    proposal: proposal
      ? {
          strategy: id(proposal.strategy, 'proposal.strategy'),
          advisoryOnly: proposal.advisoryOnly === true,
          actionKind: id(proposal.action?.kind, 'proposal.action.kind'),
        }
      : null,
  };
}

export function serializeSpatialScene(scene) {
  const value = requireObject(scene, 'scene');
  if (value.sceneVersion !== SCENE_VERSION) throw new TypeError('scene.sceneVersion must equal 2');
  return JSON.stringify(value);
}

export { SCENE_VERSION };
