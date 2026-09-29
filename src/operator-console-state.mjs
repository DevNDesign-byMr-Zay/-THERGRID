import { runSyntheticMicrogrid } from './pipeline.mjs';
import { buildProvenanceGraph, validateProvenanceGraph } from './provenance.mjs';
import { buildSpatialScene } from './spatial-scene.mjs';
import {
  planHolographicPresentation,
} from './holographic-device-registry.mjs';
import {
  compileHolographicRenderPacket,
  validateHolographicRenderPacket,
} from './holographic-renderer-contract.mjs';
import { createSolvaerCollaborationEvidence } from './solvaer-collaboration-evidence.mjs';
import { evaluateSolvaerCandidate } from './solvaer-simulation-gateway.mjs';
import {
  createSolvaerSimulationOperatorProjection,
  validateSolvaerSimulationOperatorProjection,
} from './solvaer-simulation-operator-projection.mjs';
import {
  createSolvaerOperatorEvidenceSummary,
  validateSolvaerOperatorEvidenceSummary,
} from './solvaer-operator-evidence-summary.mjs';
import {
  buildSolvaerOperatorAttentionFromSummary,
  validateSolvaerOperatorAttention,
} from './solvaer-operator-attention.mjs';
import {
  createOperatorProvenanceReadModel,
  validateOperatorProvenanceReadModel,
} from './operator-provenance-read-model.mjs';
import {
  createOperatorEvidencePackage,
  validateOperatorEvidencePackage,
} from './operator-evidence-package.mjs';
import {
  createOperatorDashboardView,
  validateOperatorDashboardView,
} from './operator-dashboard-view.mjs';

const OPERATOR_CONSOLE_STATE_VERSION = 1;

const SYNTHETIC_OPERATOR_FIXTURE = Object.freeze({
  schemaVersion: 1,
  snapshotId: 'aethergrid-operator-demo-001',
  observedAt: '2026-09-29T12:00:00.000Z',
  assets: Object.freeze([
    Object.freeze({ id: 'solar-1', kind: 'solar', powerKw: 40, capacityKw: 50 }),
    Object.freeze({ id: 'wind-1', kind: 'wind', powerKw: 20, capacityKw: 30 }),
    Object.freeze({
      id: 'battery-1',
      kind: 'battery',
      powerKw: 0,
      capacityKw: 25,
      capacityKwh: 100,
      stateOfChargeKwh: 60,
    }),
    Object.freeze({ id: 'load-1', kind: 'load', powerKw: 45, flexible: true }),
    Object.freeze({
      id: 'grid-1',
      kind: 'grid_interconnect',
      powerKw: -15,
      importLimitKw: 80,
      exportLimitKw: 40,
    }),
  ]),
  topology: Object.freeze({
    nodes: Object.freeze(['node-a']),
    connections: Object.freeze([
      Object.freeze({ assetId: 'solar-1', nodeId: 'node-a' }),
      Object.freeze({ assetId: 'wind-1', nodeId: 'node-a' }),
      Object.freeze({ assetId: 'battery-1', nodeId: 'node-a' }),
      Object.freeze({ assetId: 'load-1', nodeId: 'node-a' }),
      Object.freeze({ assetId: 'grid-1', nodeId: 'node-a' }),
    ]),
  }),
});

const OPERATOR_PRESENTATION_DEVICES = Object.freeze([
  Object.freeze({
    id: 'aethergrid-web-console',
    type: 'web-dashboard',
    capabilities: Object.freeze([
      'topology',
      'power-flows',
      'forecast-delta',
      'simulation-evidence',
      'operator-attention',
    ]),
    online: true,
  }),
  Object.freeze({
    id: 'aethergrid-volumetric-reference',
    type: 'volumetric-3d',
    capabilities: Object.freeze([
      'topology',
      'power-flows',
      'forecast-delta',
      'simulation-evidence',
      'operator-attention',
    ]),
    online: true,
  }),
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function buildOperatorEvidence(run, snapshot) {
  const candidate = {
    experimentId: run.experimentId,
    snapshotId: snapshot.snapshotId,
    dispatchDeltaKw: 0.25,
  };
  const provenanceRef = {
    experimentId: run.experimentId,
    snapshotId: snapshot.snapshotId,
  };

  const collaborationEvidence = createSolvaerCollaborationEvidence({
    request: run.solvaerRequest,
    candidate,
    provenanceRef,
  });

  const evaluation = evaluateSolvaerCandidate({
    request: run.solvaerRequest,
    candidate,
    provenanceRef,
    collaborationEvidence,
    twinState: run.twinState,
    proposal: run.proposal,
  });

  const simulationEvidenceSource = {
    accepted: evaluation.accepted,
    collaborationEvidenceRef: evaluation.collaborationEvidenceRef,
    simulation: evaluation.simulation,
  };

  const operatorProjection = createSolvaerSimulationOperatorProjection({
    evidence: evaluation.simulationEvidence,
    source: simulationEvidenceSource,
  });

  if (
    !validateSolvaerSimulationOperatorProjection(operatorProjection, {
      evidence: evaluation.simulationEvidence,
      source: simulationEvidenceSource,
    })
  ) {
    throw new Error('ÆTHERGRID operator projection failed validation');
  }

  const baseProvenanceValid = validateProvenanceGraph(run.provenance, {
    requiredTypes: [
      'telemetry',
      'twin-state',
      'forecast',
      'operating-proposal',
      'simulation',
      'decision-receipt',
      'spatial-scene',
      'render-packet',
    ],
  });

  if (!baseProvenanceValid) {
    throw new Error('ÆTHERGRID base provenance failed validation');
  }

  const summary = createSolvaerOperatorEvidenceSummary({
    snapshotId: snapshot.snapshotId,
    experimentId: run.experimentId,
    simulationStatus: run.simulation.status,
    receiptId: run.receipt.receiptId,
    sceneId: run.scene.sceneId,
    renderTarget: run.renderPacket.target,
    assetNodeRefs: run.twinState.topology.assetNodeRefs,
    provenanceValid: baseProvenanceValid,
    promotionStatus: run.promotion.status,
    authoritative: run.promotion.authoritative,
    solvaerRequestId: run.solvaerRequest.requestId,
    collaborationEvidenceFingerprint: collaborationEvidence.evidenceFingerprint,
    simulationEvidenceFingerprint: evaluation.simulationEvidence.simulationEvidenceFingerprint,
    operatorProjectionFingerprint: operatorProjection.projectionFingerprint,
    operatorProjectionValid: true,
    operatorInterpretation: operatorProjection.interpretation,
    operatorResidualBalanceKw: operatorProjection.metrics.residualBalanceKw,
    operatorGridAdjustmentKw: operatorProjection.metrics.gridAdjustmentKw,
    operatorPromotionEligible: operatorProjection.promotionEligible,
    operatorAdvisoryOnly: operatorProjection.safety.advisoryOnly,
    operatorAuthoritative: operatorProjection.safety.authoritative,
    operatorActuatesHardware: operatorProjection.safety.actuatesHardware,
  });

  if (!validateSolvaerOperatorEvidenceSummary(summary)) {
    throw new Error('ÆTHERGRID operator evidence summary failed validation');
  }

  const operatorAttention = buildSolvaerOperatorAttentionFromSummary(summary);
  if (!validateSolvaerOperatorAttention(operatorAttention)) {
    throw new Error('ÆTHERGRID operator attention failed validation');
  }

  const operatorProvenance = buildProvenanceGraph({
    snapshot,
    twinState: run.twinState,
    forecast: run.forecast,
    proposal: run.proposal,
    simulation: run.simulation,
    receipt: run.receipt,
    scene: run.scene,
    renderPacket: run.renderPacket,
    collaborationEvidence,
    operatorAttention,
    experimentId: run.experimentId,
  });

  if (
    !validateProvenanceGraph(operatorProvenance, {
      requiredTypes: ['solvaer-collaboration', 'operator-attention'],
    })
  ) {
    throw new Error('ÆTHERGRID operator provenance failed validation');
  }

  const operatorReadModel = createOperatorProvenanceReadModel({
    graph: operatorProvenance,
    attention: operatorAttention,
  });

  if (
    !validateOperatorProvenanceReadModel(operatorReadModel, {
      graph: operatorProvenance,
      attention: operatorAttention,
    })
  ) {
    throw new Error('ÆTHERGRID operator provenance read model failed validation');
  }

  const evidencePackage = createOperatorEvidencePackage({
    attention: operatorAttention,
    provenance: operatorProvenance,
    readModel: operatorReadModel,
  });

  if (
    !validateOperatorEvidencePackage(evidencePackage, {
      attention: operatorAttention,
      provenance: operatorProvenance,
      readModel: operatorReadModel,
    })
  ) {
    throw new Error('ÆTHERGRID operator evidence package failed validation');
  }

  const dashboard = createOperatorDashboardView(evidencePackage);
  if (!validateOperatorDashboardView(dashboard, evidencePackage)) {
    throw new Error('ÆTHERGRID operator dashboard failed validation');
  }

  return {
    collaborationEvidence,
    evaluation,
    operatorProjection,
    operatorAttention,
    operatorProvenance,
    operatorReadModel,
    evidencePackage,
    dashboard,
  };
}

export function createOperatorConsoleState() {
  const snapshot = structuredClone(SYNTHETIC_OPERATOR_FIXTURE);
  const run = runSyntheticMicrogrid(snapshot);
  const evidence = buildOperatorEvidence(run, snapshot);

  const operatorScene = buildSpatialScene({
    twinState: run.twinState,
    proposal: run.proposal,
    forecast: run.forecast,
    simulation: run.simulation,
    solverComparison: run.scene.evidence.solverComparison,
    policyGates: run.scene.evidence.policyGates,
    provenance: {
      experimentId: run.experimentId,
      snapshotId: snapshot.snapshotId,
      receiptId: run.receipt.receiptId,
    },
    attention: evidence.operatorAttention.items,
  });

  const presentation = planHolographicPresentation({
    scene: operatorScene,
    devices: OPERATOR_PRESENTATION_DEVICES,
    preferredTarget: 'web-dashboard',
  });

  const renderPacket = compileHolographicRenderPacket({
    scene: operatorScene,
    presentation,
    experimentId: run.experimentId,
    receiptId: run.receipt.receiptId,
    operatorAttentionFingerprint: evidence.operatorAttention.attentionFingerprint,
  });

  if (!validateHolographicRenderPacket(renderPacket)) {
    throw new Error('ÆTHERGRID operator render packet failed validation');
  }

  return deepFreeze({
    version: OPERATOR_CONSOLE_STATE_VERSION,
    source: {
      kind: 'validated-synthetic-demo',
      snapshotId: snapshot.snapshotId,
      observedAt: snapshot.observedAt,
      liveTelemetry: false,
    },
    twin: {
      snapshotId: run.twinState.snapshotId,
      observedAt: run.twinState.observedAt,
      topology: run.twinState.topology,
      totals: run.twinState.totals,
      assetStates: run.twinState.assetStates,
      storage: run.twinState.storage,
      balanced: run.twinState.balanced,
    },
    simulation: {
      backend: run.simulation.backend,
      status: run.simulation.status,
      durationMinutes: run.simulation.durationMinutes,
      residualBalanceKw: run.simulation.outputs.residualBalanceKw,
      gridAdjustmentKw: run.simulation.outputs.gridAdjustmentKw,
      operatorProjection: evidence.operatorProjection,
    },
    dashboard: evidence.dashboard,
    spatialScene: operatorScene,
    holographic: {
      presentation,
      renderPacket,
    },
    evidence: {
      packageFingerprint: evidence.evidencePackage.packageFingerprint,
      attentionFingerprint: evidence.operatorAttention.attentionFingerprint,
      provenanceFingerprint: evidence.evidencePackage.manifest.provenanceFingerprint,
      viewFingerprint: evidence.evidencePackage.manifest.viewFingerprint,
      operatorItems: evidence.dashboard.items,
      safety: evidence.evidencePackage.safety,
    },
    safety: {
      advisoryOnly: true,
      authoritative: false,
      actuatesHardware: false,
      promotionEligible: false,
      dispatchesInfrastructure: false,
      deploysInfrastructure: false,
    },
  });
}

export {
  OPERATOR_CONSOLE_STATE_VERSION,
  SYNTHETIC_OPERATOR_FIXTURE,
};
