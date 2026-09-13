const SCENE_VERSION = 1;

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function id(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

export function buildSpatialScene({ twinState, proposal = null, alerts = [] } = {}) {
  const twin = requireObject(twinState, 'twinState');
  const totals = requireObject(twin.totals, 'twinState.totals');
  finite(totals.generationKw, 'twinState.totals.generationKw');
  finite(totals.loadKw, 'twinState.totals.loadKw');
  if (!Array.isArray(alerts)) throw new TypeError('alerts must be an array');

  return {
    sceneVersion: SCENE_VERSION,
    snapshotId: id(twin.snapshotId, 'twinState.snapshotId'),
    observedAt: id(twin.observedAt, 'twinState.observedAt'),
    coordinateSystem: 'thergrid-logical-grid-v1',
    nodes: [],
    layers: {
      topology: true,
      powerFlows: true,
      alerts: alerts.map((alert, index) => ({
        id: id(alert.id ?? `alert-${index}`, `alerts[${index}].id`),
        severity: id(alert.severity ?? 'info', `alerts[${index}].severity`),
        message: id(alert.message ?? 'Unspecified alert', `alerts[${index}].message`),
      })),
      provenance: true,
    },
    metrics: {
      generationKw: totals.generationKw,
      loadKw: totals.loadKw,
      balanceKw: finite(totals.balanceKw, 'twinState.totals.balanceKw'),
      renewableSharePercent: totals.renewableSharePercent ?? null,
    },
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
  if (value.sceneVersion !== SCENE_VERSION) throw new TypeError('scene.sceneVersion must equal 1');
  return JSON.stringify(value);
}
