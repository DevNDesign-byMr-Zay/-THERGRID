import { deriveTwinState } from './twin.mjs';
import { buildPersistenceForecast, buildBaselineOperatingProposal } from './planning.mjs';
import { buildDecisionReceipt, fingerprintDecisionReceipt } from './decision-receipt.mjs';
import { buildSpatialScene } from './spatial-scene.mjs';
import { simulateProposal } from './simulation.mjs';

export function runSyntheticMicrogrid(snapshot) {
  const twinState = deriveTwinState(snapshot);
  const forecast = buildPersistenceForecast(twinState);
  const proposal = buildBaselineOperatingProposal(twinState, forecast);
  const simulation = simulateProposal({ twinState, proposal });
  const receipt = buildDecisionReceipt({ twinState, forecast, proposal });
  const receiptId = fingerprintDecisionReceipt(receipt);
  const scene = buildSpatialScene({ twinState, proposal });

  return { twinState, forecast, proposal, simulation, receipt: { ...receipt, receiptId }, scene };
}
