import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { createSolvaerOptimizationRequest } from '../src/solvaer-optimization-contract.mjs';
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

function collaborationFixture(snapshotId) {
  const input = snapshot(snapshotId);
  const pipeline = runSyntheticMicrogrid(input);
  const candidate = {
    experimentId: pipeline.experimentId,
    snapshotId: input.snapshotId,
    dispatchDeltaKw: 0.25,
  };
  const provenanceRef = {
    experimentId: pipeline.experimentId,
    snapshotId: input.snapshotId,
  };
  const collaborationEvidence = createSolvaerCollaborationEvidence({
    request: pipeline.solvaerRequest,
    candidate,
    provenanceRef,
  });
  return { input, pipeline, candidate, provenanceRef, collaborationEvidence };
}

test('routes a receipt-bound SOLVÆR candidate through simulation without promotion authority', () => {
  const fixture = collaborationFixture('snapshot-solvaer-gateway');
  const result = evaluateSolvaerCandidate({
    request: fixture.pipeline.solvaerRequest,
    candidate: fixture.candidate,
    provenanceRef: fixture.provenanceRef,
    collaborationEvidence: fixture.collaborationEvidence,
    twinState: fixture.pipeline.twinState,
    proposal: fixture.pipeline.proposal,
  });

  assert.equal(result.accepted.experimentId, fixture.pipeline.experimentId);
  assert.equal(result.accepted.snapshotId, fixture.input.snapshotId);
  assert.equal(result.collaborationEvidenceRef.evidenceFingerprint, fixture.collaborationEvidence.evidenceFingerprint);
  assert.equal(result.collaborationEvidenceRef.requestId, fixture.pipeline.solvaerRequest.requestId);
  assert.equal(result.simulation.status, 'passed');
  assert.equal(result.handoff, 'simulation-required');
  assert.equal(result.promotionEligible, false);
  assert.equal(result.safety.authoritative, false);
  assert.equal(result.safety.actuatesHardware, false);
  assert.equal(Object.isFrozen(result.collaborationEvidenceRef), true);
});

test('rejects missing or tampered collaboration evidence before simulation', () => {
  const fixture = collaborationFixture('snapshot-solvaer-required-evidence');
  const args = {
    request: fixture.pipeline.solvaerRequest,
    candidate: fixture.candidate,
    provenanceRef: fixture.provenanceRef,
    twinState: fixture.pipeline.twinState,
    proposal: fixture.pipeline.proposal,
  };

  assert.throws(
    () => evaluateSolvaerCandidate(args),
    /collaborationEvidence must be an object/,
  );
  assert.throws(
    () => evaluateSolvaerCandidate({
      ...args,
      collaborationEvidence: {
        ...fixture.collaborationEvidence,
        evidenceFingerprint: '0'.repeat(64),
      },
    }),
    /validated SOLVÆR collaboration evidence is required before simulation/,
  );
});

test('rejects collaboration evidence from a different request identity', () => {
  const fixture = collaborationFixture('snapshot-solvaer-cross-request');
  const otherRequest = createSolvaerOptimizationRequest({
    experimentId: fixture.pipeline.solvaerRequest.experimentId,
    snapshotId: fixture.pipeline.solvaerRequest.snapshotId,
    twinStateRef: fixture.pipeline.solvaerRequest.twinStateRef,
    objective: fixture.pipeline.solvaerRequest.objective,
    constraints: fixture.pipeline.solvaerRequest.constraints,
    requestId: 'solvaer:other-request',
  });
  const otherEvidence = createSolvaerCollaborationEvidence({
    request: otherRequest,
    candidate: fixture.candidate,
    provenanceRef: fixture.provenanceRef,
  });

  assert.throws(
    () => evaluateSolvaerCandidate({
      request: fixture.pipeline.solvaerRequest,
      candidate: fixture.candidate,
      provenanceRef: fixture.provenanceRef,
      collaborationEvidence: otherEvidence,
      twinState: fixture.pipeline.twinState,
      proposal: fixture.pipeline.proposal,
    }),
    /collaboration evidence requestId must match accepted request/,
  );
});

test('rejects evidence whose nested candidate does not match the accepted candidate', () => {
  const fixture = collaborationFixture('snapshot-solvaer-candidate-bind');
  const differentCandidate = { ...fixture.candidate, dispatchDeltaKw: 0.5 };

  assert.throws(
    () => evaluateSolvaerCandidate({
      request: fixture.pipeline.solvaerRequest,
      candidate: differentCandidate,
      provenanceRef: fixture.provenanceRef,
      collaborationEvidence: fixture.collaborationEvidence,
      twinState: fixture.pipeline.twinState,
      proposal: fixture.pipeline.proposal,
    }),
    /collaboration evidence candidate must match accepted candidate/,
  );
});

test('rejects evidence whose nested provenance does not match accepted provenance', () => {
  const fixture = collaborationFixture('snapshot-solvaer-provenance-bind');
  const differentProvenance = {
    ...fixture.provenanceRef,
    source: 'alternate-provenance',
  };

  assert.throws(
    () => evaluateSolvaerCandidate({
      request: fixture.pipeline.solvaerRequest,
      candidate: fixture.candidate,
      provenanceRef: differentProvenance,
      collaborationEvidence: fixture.collaborationEvidence,
      twinState: fixture.pipeline.twinState,
      proposal: fixture.pipeline.proposal,
    }),
    /collaboration evidence provenance must match accepted provenance/,
  );
});

test('rejects a candidate from a different snapshot before simulation', () => {
  const fixture = collaborationFixture('snapshot-solvaer-mismatch');
  assert.throws(
    () =>
      evaluateSolvaerCandidate({
        request: fixture.pipeline.solvaerRequest,
        candidate: { ...fixture.candidate, snapshotId: 'other-snapshot' },
        provenanceRef: fixture.provenanceRef,
        collaborationEvidence: fixture.collaborationEvidence,
        twinState: fixture.pipeline.twinState,
        proposal: fixture.pipeline.proposal,
      }),
    /candidate snapshotId must match request/,
  );
});
