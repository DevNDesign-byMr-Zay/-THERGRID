import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { buildProvenanceGraph, validateProvenanceGraph } from '../src/provenance.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { evaluateSolvaerCandidate } from '../src/solvaer-simulation-gateway.mjs';
import {
  createSolvaerSimulationOperatorProjection,
  validateSolvaerSimulationOperatorProjection,
} from '../src/solvaer-simulation-operator-projection.mjs';
import {
  createSolvaerOperatorEvidenceSummary,
  validateSolvaerOperatorEvidenceSummary,
} from '../src/solvaer-operator-evidence-summary.mjs';
import {
  buildSolvaerOperatorAttentionFromSummary,
  validateSolvaerOperatorAttention,
} from '../src/solvaer-operator-attention.mjs';
import {
  createOperatorProvenanceReadModel,
  validateOperatorProvenanceReadModel,
} from '../src/operator-provenance-read-model.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'demo-microgrid-001',
  observedAt: '2026-01-01T00:00:00.000Z',
  assets: [
    { id: 'solar-1', kind: 'solar', powerKw: 12, capacityKw: 15 },
    { id: 'load-1', kind: 'load', powerKw: 10, flexible: true },
    {
      id: 'grid-1',
      kind: 'grid_interconnect',
      powerKw: -2,
      importLimitKw: 80,
      exportLimitKw: 40,
    },
  ],
  topology: {
    nodes: ['node-a'],
    connections: [
      { assetId: 'solar-1', nodeId: 'node-a' },
      { assetId: 'load-1', nodeId: 'node-a' },
      { assetId: 'grid-1', nodeId: 'node-a' },
    ],
  },
};

const run = runSyntheticMicrogrid(snapshot);
const provenanceValid = validateProvenanceGraph(run.provenance, {
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

if (run.simulation.status !== 'passed') {
  throw new Error(`demo simulation failed: ${run.simulation.status}`);
}
if (!provenanceValid) {
  throw new Error('demo provenance graph failed validation');
}
if (run.promotion.authoritative !== false) {
  throw new Error('demo promotion gate must remain non-authoritative');
}

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
const operatorProjectionValid = validateSolvaerSimulationOperatorProjection(operatorProjection, {
  evidence: evaluation.simulationEvidence,
  source: simulationEvidenceSource,
});

if (!operatorProjectionValid) {
  throw new Error('demo operator projection failed validation');
}
if (evaluation.promotionEligible !== false || evaluation.simulationEvidence.promotionEligible !== false) {
  throw new Error('demo SOLVÆR evidence chain must remain non-promotable');
}
if (
  operatorProjection.promotionEligible !== false ||
  operatorProjection.safety.authoritative !== false ||
  operatorProjection.safety.advisoryOnly !== true ||
  operatorProjection.safety.actuatesHardware !== false
) {
  throw new Error('demo operator projection must remain review-only and non-authoritative');
}

const summary = createSolvaerOperatorEvidenceSummary({
  snapshotId: snapshot.snapshotId,
  experimentId: run.experimentId,
  simulationStatus: run.simulation.status,
  receiptId: run.receipt.receiptId,
  sceneId: run.scene.sceneId,
  renderTarget: run.renderPacket.target,
  provenanceValid,
  promotionStatus: run.promotion.status,
  authoritative: run.promotion.authoritative,
  solvaerRequestId: run.solvaerRequest.requestId,
  collaborationEvidenceFingerprint: collaborationEvidence.evidenceFingerprint,
  simulationEvidenceFingerprint: evaluation.simulationEvidence.simulationEvidenceFingerprint,
  operatorProjectionFingerprint: operatorProjection.projectionFingerprint,
  operatorProjectionValid,
  operatorInterpretation: operatorProjection.interpretation,
  operatorResidualBalanceKw: operatorProjection.metrics.residualBalanceKw,
  operatorGridAdjustmentKw: operatorProjection.metrics.gridAdjustmentKw,
  operatorPromotionEligible: operatorProjection.promotionEligible,
  operatorAdvisoryOnly: operatorProjection.safety.advisoryOnly,
  operatorAuthoritative: operatorProjection.safety.authoritative,
  operatorActuatesHardware: operatorProjection.safety.actuatesHardware,
});

if (!validateSolvaerOperatorEvidenceSummary(summary)) {
  throw new Error('demo operator evidence summary failed validation');
}

const operatorAttention = buildSolvaerOperatorAttentionFromSummary(summary);
if (!validateSolvaerOperatorAttention(operatorAttention)) {
  throw new Error('demo operator attention failed validation');
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
  throw new Error('demo operator provenance graph failed validation');
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
  throw new Error('demo operator provenance read model failed validation');
}

process.stdout.write(`${JSON.stringify(operatorReadModel, null, 2)}\n`);
