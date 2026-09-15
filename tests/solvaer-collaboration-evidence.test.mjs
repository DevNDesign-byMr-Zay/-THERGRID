import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { createSolvaerCollaborationEvidence, validateSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'snapshot-evidence-1',
  observedAt: '2026-09-13T00:00:00.000Z',
  assets: [
    { id: 'solar-1', kind: 'solar', powerKw: 12, capacityKw: 15 },
    { id: 'load-1', kind: 'load', powerKw: 10, flexible: true },
    { id: 'grid-1', kind: 'grid_interconnect', powerKw: -2, importLimitKw: 80, exportLimitKw: 40 },
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

test('SOLVÆR collaboration evidence is deterministic and simulation-bound', () => {
  const run = runSyntheticMicrogrid(snapshot);
  const candidate = {
    experimentId: run.experimentId,
    snapshotId: snapshot.snapshotId,
    proposal: run.proposal,
    model: 'solvaer-reference',
  };
  const provenanceRef = { experimentId: run.experimentId, snapshotId: snapshot.snapshotId };
  const evidence = createSolvaerCollaborationEvidence({ request: run.solvaerRequest, candidate, provenanceRef });

  assert.equal(validateSolvaerCollaborationEvidence(evidence), true);
  assert.equal(evidence.requestId, run.solvaerRequest.requestId);
  assert.equal(evidence.experimentId, run.experimentId);
  assert.equal(evidence.snapshotId, snapshot.snapshotId);
  assert.equal(evidence.safety.authoritative, false);
  assert.equal(evidence.safety.actuatesHardware, false);
  assert.equal(evidence.handoff, 'simulation-required');
});

test('tampering collaboration evidence fails closed', () => {
  const run = runSyntheticMicrogrid(snapshot);
  const evidence = createSolvaerCollaborationEvidence({
    request: run.solvaerRequest,
    candidate: { experimentId: run.experimentId, snapshotId: snapshot.snapshotId, proposal: run.proposal },
    provenanceRef: { experimentId: run.experimentId, snapshotId: snapshot.snapshotId },
  });
  assert.equal(validateSolvaerCollaborationEvidence({ ...evidence, requestId: 'other-request' }), false);
  assert.equal(validateSolvaerCollaborationEvidence({ ...evidence, snapshotId: 'other-snapshot' }), false);
  assert.equal(validateSolvaerCollaborationEvidence({ ...evidence, safety: { ...evidence.safety, authoritative: true } }), false);
});
