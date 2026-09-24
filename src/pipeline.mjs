import { deriveTwinState } from './twin.mjs';
import { buildPersistenceForecast, buildBaselineOperatingProposal } from './planning.mjs';
import { buildDecisionReceipt, fingerprintDecisionReceipt } from './decision-receipt.mjs';
import { buildSpatialScene, getSpatialSceneId } from './spatial-scene.mjs';
import { planHolographicPresentation } from './holographic-device-registry.mjs';
import { compileHolographicRenderPacket } from './holographic-renderer-contract.mjs';
import { simulateProposal } from './simulation.mjs';
import {
  buildProvenanceGraph,
  fingerprintExperiment,
  validateProvenanceGraph,
} from './provenance.mjs';
import {
  buildSolverEvidence,
  compareSolverEvidence,
  evaluatePromotionGate,
} from './solver-evaluation.mjs';
import { createSolvaerOptimizationRequest } from './solvaer-optimization-contract.mjs';

const DEFAULT_PRESENTATION_DEVICES = Object.freeze([
  {
    id: 'holo-mat-reference',
    type: 'holo-mat',
    capabilities: ['topology', 'power-flows', 'forecast-delta'],
    online: true,
  },
  {
    id: 'projector-reference',
    type: 'projector',
    capabilities: ['topology', 'alerts'],
    online: true,
  },
  {
    id: 'volumetric-reference',
    type: 'volumetric-3d',
    capabilities: ['topology', 'power-flows', 'forecast-delta'],
    online: true,
  },
]);

export function runSyntheticMicrogrid(
  snapshot,
  { presentationDevices = DEFAULT_PRESENTATION_DEVICES, preferredPresentationTarget = null } = {},
) {
  const twinState = deriveTwinState(snapshot);
  const forecast = buildPersistenceForecast(twinState);
  const proposal = buildBaselineOperatingProposal(twinState, forecast);
  const simulation = simulateProposal({ twinState, proposal });
  const receipt = buildDecisionReceipt({ twinState, forecast, proposal });
  const receiptId = fingerprintDecisionReceipt(receipt);
  const experimentId = fingerprintExperiment({
    inputs: { snapshotId: snapshot.snapshotId, observedAt: snapshot.observedAt },
    constraints: proposal.constraints ?? null,
    model: { identity: 'thergrid-classical-reference-v1' },
    solver: { identity: 'thergrid-reference-v1' },
    seed: simulation.seed ?? null,
  });
  const receiptWithId = { ...receipt, receiptId };
  const provenanceSeed = { experimentId, snapshotId: snapshot.snapshotId, receiptId };
  const anticipatedSceneId = getSpatialSceneId(snapshot.snapshotId);
  const solverEvidence = buildSolverEvidence({
    experimentId,
    inputSnapshotId: snapshot.snapshotId,
    candidate: {
      model: 'thergrid-classical-reference',
      solver: 'thergrid-reference',
      version: 'v1',
    },
    constraints: proposal.constraints ?? null,
    seed: simulation.seed ?? null,
    objective: Math.abs(simulation.outputs.residualBalanceKw),
    feasible:
      simulation.status === 'passed' && Math.abs(simulation.outputs.residualBalanceKw) <= 0.000001,
    runtimeMs: simulation.runtimeMs,
    timeout: false,
    provenance: [receiptId, anticipatedSceneId],
  });
  const solverComparison = compareSolverEvidence([solverEvidence]);
  const preRenderPolicyGates = Object.freeze({
    status: simulation.status === 'passed' ? 'eligible-for-render-review' : 'rejected',
    checks: Object.freeze({
      simulationPassed: simulation.status === 'passed',
      receiptValid: receiptId === fingerprintDecisionReceipt(receipt),
      solverEvidenceComplete:
        solverEvidence.feasible === true &&
        solverEvidence.timeout === false &&
        solverEvidence.provenance.length >= 2,
    }),
    authoritative: false,
    reason:
      simulation.status === 'passed'
        ? 'validated evidence may be presented for operator review'
        : 'simulation evidence is not eligible for operator review',
  });
  const scene = buildSpatialScene({
    twinState,
    proposal,
    forecast,
    simulation,
    solverComparison,
    policyGates: preRenderPolicyGates,
    provenance: provenanceSeed,
  });
  const presentation = planHolographicPresentation({
    scene,
    devices: presentationDevices,
    preferredTarget: preferredPresentationTarget,
  });
  const renderPacket = compileHolographicRenderPacket({
    scene,
    presentation,
    experimentId,
    receiptId,
  });
  const provenance = buildProvenanceGraph({
    snapshot,
    twinState,
    forecast,
    proposal,
    simulation,
    receipt: receiptWithId,
    scene,
    renderPacket,
    experimentId,
  });
  const provenanceValid = validateProvenanceGraph(provenance, {
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
  const promotion = evaluatePromotionGate({
    evidence: solverEvidence,
    validation: {
      simulationPassed: simulation.status === 'passed',
      receiptValid: receiptId === fingerprintDecisionReceipt(receipt),
      provenanceValid,
    },
  });
  const solvaerRequest = createSolvaerOptimizationRequest({
    experimentId,
    snapshotId: snapshot.snapshotId,
    twinStateRef: `twin-state:${snapshot.snapshotId}`,
    objective: 'explore lower residual balance while preserving simulation constraints',
    constraints: proposal.constraints ?? null,
  });

  return {
    twinState,
    forecast,
    proposal,
    simulation,
    receipt: receiptWithId,
    scene,
    presentation,
    renderPacket,
    experimentId,
    solverEvidence,
    promotion,
    provenance,
    solvaerRequest,
  };
}
