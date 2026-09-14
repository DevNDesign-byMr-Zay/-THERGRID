import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { evaluateSolvaerDecisionHandoff } from '../src/solvaer-decision-handoff.mjs';

function snapshot(snapshotId) {
  return {
    schemaVersion: 1,
    snapshotId,
    observedAt: '2026-09-13T00:00:00.000Z',
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
}

test('SOLVÆR decision handoff produces simulation evidence without promotion authority', () => {
  const result = runSyntheticMicrogrid(snapshot('snapshot-solvaer-handoff'));
  const candidate = {
    experimentId: result.experimentId,
    snapshotId: result.twinState.snapshotId,
    proposal: result.proposal,
  };
  const handoff = evaluateSolvaerDecisionHandoff({
    request: result.solvaerRequest,
    candidate,
    provenanceRef: result.provenance,
    twinState: result.twinState,
    forecast: result.forecast,
    proposal: result.proposal,
  });

  assert.equal(handoff.experimentId, result.experimentId);
  assert.equal(handoff.simulation.status, 'passed');
  assert.equal(handoff.promotionEligible, false);
  assert.equal(handoff.handoff, 'simulation-evidence-required');
  assert.equal(handoff.safety.authoritative, false);
  assert.equal(handoff.safety.actuatesHardware, false);
  assert.equal(handoff.safety.advisoryOnly, true);
  assert.equal(typeof handoff.decisionReceipt.receiptId, 'string');
});
