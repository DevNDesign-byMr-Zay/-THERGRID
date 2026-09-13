import { deriveTwinState } from './twin.mjs';
import { buildPersistenceForecast, buildBaselineOperatingProposal } from './planning.mjs';
import { buildDecisionReceipt, fingerprintDecisionReceipt } from './decision-receipt.mjs';
import { buildSpatialScene } from './spatial-scene.mjs';
import { simulateProposal } from './simulation.mjs';
import { buildProvenanceGraph, fingerprintExperiment } from './provenance.mjs';

export function runSyntheticMicrogrid(snapshot) {
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
  const provenanceSeed = {
    experimentId,
    snapshotId: snapshot.snapshotId,
    receiptId,
  };
  const scene = buildSpatialScene({
    twinState,
    proposal,
    provenance: provenanceSeed,
  });
  const provenance = buildProvenanceGraph({
    snapshot,
    twinState,
    forecast,
    proposal,
    simulation,
    receipt: { ...receipt, receiptId },
    scene,
  });

  return {
    twinState,
    forecast,
    proposal,
    simulation,
    receipt: { ...receipt, receiptId },
    scene,
    experimentId,
    provenance,
  };
}
