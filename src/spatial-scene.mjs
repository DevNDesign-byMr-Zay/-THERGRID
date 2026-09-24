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

  const experimentId = id(
    readOwnData(value, 'experimentId', 'provenance'),
    'provenance.experimentId',
  );
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

function buildSceneNodes(twin) {
  const topology = twin.topology;
  if (!topology || typeof topology !== 'object' || Array.isArray(topology)) return [];
  if (!Array.isArray(topology.nodes) || !Array.isArray(topology.assetNodeRefs)) return [];

  return topology.nodes.map((nodeId, nodeIndex) => {
    const canonicalNodeId = id(nodeId, `twinState.topology.nodes[${nodeIndex}]`);
    const assetIds = topology.assetNodeRefs
      .filter((ref) => ref?.nodeId === canonicalNodeId)
      .map((ref, refIndex) =>
        id(ref.assetId, `twinState.topology.assetNodeRefs[${refIndex}].assetId`),
      );
    return {
      id: canonicalNodeId,
      assetIds,
    };
  });
}

function buildAttentionScope(item, index) {
  if (!Array.isArray(item.assetNodeRefs)) return [];
  return item.assetNodeRefs.map((ref, refIndex) => ({
    assetId: id(ref?.assetId, `attention[${index}].assetNodeRefs[${refIndex}].assetId`),
    nodeId: id(ref?.nodeId, `attention[${index}].assetNodeRefs[${refIndex}].nodeId`),
  }));
}

function buildPowerFlowEvidence(twin) {
  if (!Array.isArray(twin.assetStates)) return [];
  return twin.assetStates.map((asset, index) => ({
    assetId: id(asset.assetId, `twinState.assetStates[${index}].assetId`),
    nodeId: id(asset.nodeId, `twinState.assetStates[${index}].nodeId`),
    kind: id(asset.kind, `twinState.assetStates[${index}].kind`),
    powerKw: finite(asset.powerKw, `twinState.assetStates[${index}].powerKw`),
  }));
}

function buildForecastDelta(twin, forecast) {
  if (forecast == null) return null;
  const value = requireObject(forecast, 'forecast');
  if (value.snapshotId !== twin.snapshotId) {
    throw new TypeError('forecast.snapshotId must match twinState.snapshotId');
  }
  const generationKw = finite(value.generationKw, 'forecast.generationKw');
  const loadKw = finite(value.loadKw, 'forecast.loadKw');
  return {
    method: id(value.method, 'forecast.method'),
    forecastFor: id(value.forecastFor, 'forecast.forecastFor'),
    generationKw,
    loadKw,
    generationDeltaKw: Number((generationKw - twin.totals.generationKw).toFixed(6)),
    loadDeltaKw: Number((loadKw - twin.totals.loadKw).toFixed(6)),
  };
}

function buildSolverComparisonEvidence(snapshotId, comparison) {
  if (comparison == null) return [];
  if (!Array.isArray(comparison)) {
    throw new TypeError('solverComparison must be an array');
  }

  return comparison.map((entry, index) => {
    const value = requireObject(entry, `solverComparison[${index}]`);
    const candidate = requireObject(value.candidate, `solverComparison[${index}].candidate`);
    return {
      fingerprint: id(value.fingerprint, `solverComparison[${index}].fingerprint`),
      candidate: {
        model: id(candidate.model, `solverComparison[${index}].candidate.model`),
        solver: id(candidate.solver, `solverComparison[${index}].candidate.solver`),
        version: id(candidate.version, `solverComparison[${index}].candidate.version`),
      },
      feasible: value.feasible === true,
      objective: finite(value.objective, `solverComparison[${index}].objective`),
      runtimeMs: finite(value.runtimeMs, `solverComparison[${index}].runtimeMs`),
      timeout: value.timeout === true,
      fallback:
        value.fallback == null ? null : id(value.fallback, `solverComparison[${index}].fallback`),
      provenanceCount: finite(value.provenanceCount, `solverComparison[${index}].provenanceCount`),
      inputSnapshotId: snapshotId,
      advisoryOnly: true,
    };
  });
}

function buildPolicyGateEvidence(snapshotId, policyGates) {
  if (policyGates == null) return null;
  const value = requireObject(policyGates, 'policyGates');
  const checks = requireObject(value.checks, 'policyGates.checks');
  return {
    snapshotId,
    status: id(value.status, 'policyGates.status'),
    reason: id(value.reason, 'policyGates.reason'),
    checks: Object.fromEntries(
      Object.entries(checks)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, passed]) => [id(key, 'policy gate check'), passed === true]),
    ),
    authoritative: false,
    advisoryOnly: true,
  };
}

function buildSimulationEvidence(snapshotId, simulation) {
  if (simulation == null) return null;
  const value = requireObject(simulation, 'simulation');
  if (value.snapshotId !== snapshotId) {
    throw new TypeError('simulation.snapshotId must match twinState.snapshotId');
  }
  const outputs = requireObject(value.outputs, 'simulation.outputs');
  const safety = requireObject(value.safety, 'simulation.safety');
  if (safety.advisoryOnly !== true || safety.physicalActuation !== false) {
    throw new TypeError('simulation evidence must remain advisory-only and non-actuating');
  }
  return {
    backend: id(value.backend, 'simulation.backend'),
    status: id(value.status, 'simulation.status'),
    durationMinutes: finite(value.durationMinutes, 'simulation.durationMinutes'),
    runtimeMs: finite(value.runtimeMs, 'simulation.runtimeMs'),
    residualBalanceKw: finite(outputs.residualBalanceKw, 'simulation.outputs.residualBalanceKw'),
    gridAdjustmentKw: finite(outputs.gridAdjustmentKw, 'simulation.outputs.gridAdjustmentKw'),
    advisoryOnly: true,
    physicalActuation: false,
  };
}

export function buildSpatialScene({
  twinState,
  proposal = null,
  forecast = null,
  simulation = null,
  solverComparison = [],
  policyGates = null,
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
    nodes: buildSceneNodes(twin),
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
          item.evidenceRef == null ? null : id(item.evidenceRef, `attention[${index}].evidenceRef`),
        affectedMetric:
          item.affectedMetric == null
            ? null
            : id(item.affectedMetric, `attention[${index}].affectedMetric`),
        recommendedAdvisoryAction:
          item.recommendedAdvisoryAction == null
            ? null
            : id(item.recommendedAdvisoryAction, `attention[${index}].recommendedAdvisoryAction`),
        stalenessBoundary:
          item.stalenessBoundary == null
            ? null
            : id(item.stalenessBoundary, `attention[${index}].stalenessBoundary`),
        assetNodeRefs: buildAttentionScope(item, index),
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
    evidence: {
      powerFlows: buildPowerFlowEvidence(twin),
      forecastDelta: buildForecastDelta(twin, forecast),
      simulation: buildSimulationEvidence(snapshotId, simulation),
      solverComparison: buildSolverComparisonEvidence(snapshotId, solverComparison),
      policyGates: buildPolicyGateEvidence(snapshotId, policyGates),
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
