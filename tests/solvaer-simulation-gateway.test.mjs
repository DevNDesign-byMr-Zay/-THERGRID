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
    candidate: {
      experimentId: pipeline.experimentId,
      snapshotId: snapshot.snapshotId,
      dispatchDeltaKw: 0.25,
    },
    provenanceRef: {
      experimentId: pipeline.experimentId,
      snapshotId: snapshot.snapshotId,
      twinStateRef: `twin-state:${snapshot.snapshotId}`,
    },
    twinState: pipeline.twinState,
    proposal: pipeline.proposal,
  });

  assert.equal(result.accepted.experimentId, pipeline.experimentId);
  assert.equal(result.accepted.snapshotId, snapshot.snapshotId);
  assert.equal(result.accepted.twinStateRef, `twin-state:${snapshot.snapshotId}`);
  assert.equal(result.simulation.status, 'passed');
  assert.equal(result.handoff, 'simulation-required');
  assert.equal(result.promotionEligible, false);
  assert.equal(result.safety.authoritative, false);
  assert.equal(result.safety.actuatesHardware, false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.accepted), true);
  assert.equal(Object.isFrozen(result.simulation), true);
  assert.equal(Object.isFrozen(result.simulation.outputs), true);
});

test('rejects a candidate from a different snapshot before simulation', () => {
  const snapshot = {
    snapshotId: 'snapshot-solvaer-mismatch',
    observedAt: '2026-09-13T00:00:00Z',
    nodes: [{ id: 'n1', loadKw: 4, generationKw: 5 }],
  };
  const pipeline = runSyntheticMicrogrid(snapshot);
  assert.throws(
    () =>
      evaluateSolvaerCandidate({
        request: pipeline.solvaerRequest,
        candidate: { snapshotId: 'other-snapshot' },
        provenanceRef: {
          experimentId: pipeline.experimentId,
          snapshotId: snapshot.snapshotId,
        },
        twinState: pipeline.twinState,
        proposal: pipeline.proposal,
      }),
    /candidate snapshotId must match request/,
  );
});

test('rejects a gateway simulation against another twin identity', () => {
  const snapshot = {
    snapshotId: 'snapshot-solvaer-twin',
    observedAt: '2026-09-13T00:00:00Z',
    nodes: [{ id: 'n1', loadKw: 4, generationKw: 5 }],
  };
  const pipeline = runSyntheticMicrogrid(snapshot);

  assert.throws(
    () =>
      evaluateSolvaerCandidate({
        request: pipeline.solvaerRequest,
        candidate: { snapshotId: snapshot.snapshotId },
        provenanceRef: { experimentId: pipeline.experimentId },
        twinState: pipeline.twinState,
        twinStateRef: 'twin-state:other-snapshot',
        proposal: pipeline.proposal,
      }),
    /twinStateRef must match simulation twin state/,
  );
});
