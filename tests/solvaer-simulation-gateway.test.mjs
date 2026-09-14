import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { evaluateSolvaerCandidate } from '../src/solvaer-simulation-gateway.mjs';

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

test('routes immutable SOLVÆR evidence through simulation without promotion authority', () => {
  const input = snapshot('snapshot-solvaer-gateway');
  const pipeline = runSyntheticMicrogrid(input);
  const result = evaluateSolvaerCandidate({
    request: pipeline.solvaerRequest,
    candidate: {
      experimentId: pipeline.experimentId,
      snapshotId: input.snapshotId,
      twinStateRef: `twin-state:${input.snapshotId}`,
      dispatchDeltaKw: 0.25,
    },
    provenanceRef: pipeline.provenance,
    twinState: pipeline.twinState,
    proposal: pipeline.proposal,
  });

  assert.equal(result.accepted.experimentId, pipeline.experimentId);
  assert.equal(result.accepted.snapshotId, input.snapshotId);
  assert.equal(result.accepted.twinStateRef, `twin-state:${input.snapshotId}`);
  assert.equal(result.accepted.objective, pipeline.solvaerRequest.objective);
  assert.equal(result.simulation.status, 'passed');
  assert.equal(result.handoff, 'simulation-required');
  assert.equal(result.promotionEligible, false);
  assert.equal(result.safety.authoritative, false);
  assert.equal(result.safety.actuatesHardware, false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.request), true);
  assert.equal(Object.isFrozen(result.accepted), true);
  assert.equal(Object.isFrozen(result.simulation), true);
  assert.equal(Object.isFrozen(result.simulation.inputs), true);
  assert.equal(Object.isFrozen(result.simulation.outputs), true);
  assert.equal(Object.isFrozen(result.safety), true);
  assert.throws(() => {
    result.promotionEligible = true;
  }, TypeError);
});

test('rejects a candidate from a different snapshot before simulation', () => {
  const input = snapshot('snapshot-solvaer-mismatch');
  const pipeline = runSyntheticMicrogrid(input);
  assert.throws(
    () =>
      evaluateSolvaerCandidate({
        request: pipeline.solvaerRequest,
        candidate: { snapshotId: 'other-snapshot' },
        provenanceRef: {
          experimentId: pipeline.experimentId,
          snapshotId: input.snapshotId,
        },
        twinState: pipeline.twinState,
        proposal: pipeline.proposal,
      }),
    /candidate snapshotId must match request/,
  );
});

test('rejects simulation against another twin-state identity', () => {
  const input = snapshot('snapshot-solvaer-twin');
  const pipeline = runSyntheticMicrogrid(input);

  assert.throws(
    () =>
      evaluateSolvaerCandidate({
        request: pipeline.solvaerRequest,
        candidate: { snapshotId: input.snapshotId },
        provenanceRef: pipeline.provenance,
        twinState: pipeline.twinState,
        twinStateRef: 'twin-state:another-snapshot',
        proposal: pipeline.proposal,
      }),
    /twinStateRef must match simulation twin state/,
  );
});

test('rejects a request bound to another snapshot before candidate acceptance', () => {
  const input = snapshot('snapshot-solvaer-state');
  const pipeline = runSyntheticMicrogrid(input);
  const request = {
    ...pipeline.solvaerRequest,
    snapshotId: 'snapshot-other',
    twinStateRef: 'twin-state:snapshot-other',
  };

  assert.throws(
    () =>
      evaluateSolvaerCandidate({
        request,
        candidate: { snapshotId: 'snapshot-other' },
        provenanceRef: { experimentId: pipeline.experimentId },
        twinState: pipeline.twinState,
        proposal: pipeline.proposal,
      }),
    /request snapshotId must match twinState.snapshotId/,
  );
});
