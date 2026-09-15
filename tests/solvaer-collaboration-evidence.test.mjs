import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { createSolvaerCollaborationEvidence, validateSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'snapshot-evidence-1',
  observedAt: '2026-09-13T00:00:00Z',
  assets: [
    { id: 'load-1', kind: 'load', powerKw: 42 },
    { id: 'solar-1', kind: 'solar', powerKw: 40, capacityKw: 60 },
  ],
  topology: {
    nodes: ['node-load', 'node-solar'],
    connections: [
      { assetId: 'load-1', nodeId: 'node-load' },
      { assetId: 'solar-1', nodeId: 'node-solar' },
    ],
  },
};

test('SOLVÆR collaboration evidence is deterministic and simulation-bound', () => {
  const run = runSyntheticMicrogrid(snapshot);
  const candidate = { experimentId: run.experimentId, snapshotId: snapshot.snapshotId, proposal: run.proposal, model: 'solvaer-reference' };
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
  const evidence = createSolvaerCollaborationEvidence({ request: run.solvaerRequest, candidate: { experimentId: run.experimentId, snapshotId: snapshot.snapshotId, proposal: run.proposal }, provenanceRef: { experimentId: run.experimentId, snapshotId: snapshot.snapshotId } });
  assert.equal(validateSolvaerCollaborationEvidence({ ...evidence, snapshotId: 'other-snapshot' }), false);
  assert.equal(validateSolvaerCollaborationEvidence({ ...evidence, safety: { ...evidence.safety, authoritative: true } }), false);
});

test('rejects inherited safety invariants even when the original evidence fingerprint is reused', () => {
  const run = runSyntheticMicrogrid(snapshot);
  const evidence = createSolvaerCollaborationEvidence({
    request: run.solvaerRequest,
    candidate: { experimentId: run.experimentId, snapshotId: snapshot.snapshotId, proposal: run.proposal },
    provenanceRef: { experimentId: run.experimentId, snapshotId: snapshot.snapshotId },
  });
  const inheritedSafety = Object.create({ authoritative: false, actuatesHardware: false, advisoryOnly: true });
  const forged = { ...evidence, safety: inheritedSafety };
  assert.equal(forged.evidenceFingerprint, evidence.evidenceFingerprint);
  assert.equal(validateSolvaerCollaborationEvidence(forged), false);
});

test('rejects prototype-backed evidence envelopes before inherited metadata is trusted', () => {
  const run = runSyntheticMicrogrid(snapshot);
  const evidence = createSolvaerCollaborationEvidence({
    request: run.solvaerRequest,
    candidate: { experimentId: run.experimentId, snapshotId: snapshot.snapshotId, proposal: run.proposal },
    provenanceRef: { experimentId: run.experimentId, snapshotId: snapshot.snapshotId },
  });
  const forged = Object.create(evidence);
  assert.equal(validateSolvaerCollaborationEvidence(forged), false);
});
