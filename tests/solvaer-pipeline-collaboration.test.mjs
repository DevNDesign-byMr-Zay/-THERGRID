import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { evaluateSolvaerDecisionHandoff } from '../src/solvaer-decision-handoff.mjs';
import { validateSolvaerCollaborationResult } from '../src/solvaer-collaboration-validator.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'collab-snapshot-1',
  observedAt: '2026-09-14T00:00:00.000Z',
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

test('anchors a SOLVÆR candidate to the pipeline experiment and routes it through simulation evidence', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const candidate = {
    experimentId: baseline.experimentId,
    snapshotId: snapshot.snapshotId,
    proposal: baseline.proposal,
  };
  const provenanceRef = {
    experimentId: baseline.experimentId,
    snapshotId: snapshot.snapshotId,
  };

  assert.equal(
    validateSolvaerCollaborationResult({
      request: baseline.solvaerRequest,
      candidate,
      provenanceRef,
    }),
    true,
  );

  const handoff = evaluateSolvaerDecisionHandoff({
    request: baseline.solvaerRequest,
    candidate,
    provenanceRef,
    twinState: baseline.twinState,
    forecast: baseline.forecast,
    proposal: baseline.proposal,
  });

  assert.equal(handoff.experimentId, baseline.experimentId);
  assert.equal(handoff.simulation.status, 'passed');
  assert.equal(handoff.promotionEligible, false);
  assert.equal(handoff.handoff, 'simulation-evidence-required');
  assert.deepEqual(handoff.safety, {
    authoritative: false,
    actuatesHardware: false,
    advisoryOnly: true,
  });
});
