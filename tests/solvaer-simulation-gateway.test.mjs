import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { evaluateSolvaerCandidate } from '../src/solvaer-simulation-gateway.mjs';

test('routes a SOLVÆR candidate through simulation without promotion authority', () => {
  const snapshot = {
    snapshotId: 'snapshot-solvaer-gateway',
    observedAt: '2026-09-13T00:00:00Z',
    nodes: [
      { id: 'n1', loadKw: 10, generationKw: 12 },
      { id: 'n2', loadKw: 8, generationKw: 7 },
    ],
  };
  const pipeline = runSyntheticMicrogrid(snapshot);
  const result = evaluateSolvaerCandidate({
    request: pipeline.solvaerRequest,
    candidate: { experimentId: pipeline.experimentId, snapshotId: snapshot.snapshotId, dispatchDeltaKw: 0.25 },
    provenanceRef: { experimentId: pipeline.experimentId, snapshotId: snapshot.snapshotId },
    twinState: pipeline.twinState,
    proposal: pipeline.proposal,
  });

  assert.equal(result.accepted.experimentId, pipeline.experimentId);
  assert.equal(result.accepted.snapshotId, snapshot.snapshotId);
  assert.equal(result.simulation.status, 'passed');
  assert.equal(result.handoff, 'simulation-required');
  assert.equal(result.promotionEligible, false);
  assert.equal(result.safety.authoritative, false);
  assert.equal(result.safety.actuatesHardware, false);
});

test('rejects a candidate from a different snapshot before simulation', () => {
  const snapshot = {
    snapshotId: 'snapshot-solvaer-mismatch',
    observedAt: '2026-09-13T00:00:00Z',
    nodes: [{ id: 'n1', loadKw: 4, generationKw: 5 }],
  };
  const pipeline = runSyntheticMicrogrid(snapshot);
  assert.throws(() => evaluateSolvaerCandidate({
    request: pipeline.solvaerRequest,
    candidate: { snapshotId: 'other-snapshot' },
    provenanceRef: { experimentId: pipeline.experimentId, snapshotId: snapshot.snapshotId },
    twinState: pipeline.twinState,
    proposal: pipeline.proposal,
  }), /candidate snapshotId must match request/);
});
