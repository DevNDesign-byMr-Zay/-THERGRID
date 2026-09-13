import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { evaluateSolvaerDecisionHandoff } from '../src/solvaer-decision-handoff.mjs';

test('SOLVÆR decision handoff produces simulation evidence without promotion authority', () => {
  const result = runSyntheticMicrogrid({ snapshotId: 'snapshot-solvaer-handoff', observedAt: '2026-09-13T00:00:00Z', assets: [] });
  const candidate = { experimentId: result.experimentId, snapshotId: 'snapshot-solvaer-handoff', proposal: result.proposal };
  const handoff = evaluateSolvaerDecisionHandoff({
    request: result.solvaerRequest,
    candidate,
    provenanceRef: result.provenance,
    twinState: result.twinState,
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
