import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { createSolvaerCollaborationEvidence, validateSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'snapshot-evidence-1',
  observedAt: '2026-09-13T00:00:00Z',
  assets: [
    { id: 'load-1', type: 'load', demandKw: 42 },
    { id: 'gen-1', type: 'generator', capacityKw: 60, outputKw: 40 },
  ],
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
  assert.equal(validateSolvaerCollaborationEvidence({ ...evidence, snapshotId: 'other-snapshot' }), false);
  assert.equal(validateSolvaerCollaborationEvidence({ ...evidence, safety: { ...evidence.safety, authoritative: true } }), false);
});
