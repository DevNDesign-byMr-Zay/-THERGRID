import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { buildProvenanceGraph, validateProvenanceGraph } from '../src/provenance.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { buildSolvaerOperatorAttention } from '../src/solvaer-operator-attention.mjs';
import { createOperatorProvenanceReadModel } from '../src/operator-provenance-read-model.mjs';
import {
  createOperatorEvidencePackage,
  validateOperatorEvidencePackage,
} from '../src/operator-evidence-package.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'operator-package-v1',
  observedAt: '2026-09-15T00:00:00.000Z',
  assets: [
    { id: 'solar-1', kind: 'solar', powerKw: 40, capacityKw: 50 },
    { id: 'load-1', kind: 'load', powerKw: 35, flexible: true },
    {
      id: 'grid-1',
      kind: 'grid_interconnect',
      powerKw: -5,
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

function fixture() {
  const run = runSyntheticMicrogrid(snapshot);
  const candidate = {
    experimentId: run.experimentId,
    snapshotId: snapshot.snapshotId,
    proposal: run.proposal,
  };
  const provenanceRef = {
    experimentId: run.experimentId,
    snapshotId: snapshot.snapshotId,
  };
  const evidence = createSolvaerCollaborationEvidence({
    request: run.solvaerRequest,
    candidate,
    provenanceRef,
  });
  const attention = buildSolvaerOperatorAttention({
    evidence,
    twinState: run.twinState,
    decision: {
      experimentId: run.experimentId,
      requestId: run.solvaerRequest.requestId,
      simulation: { status: 'passed' },
    },
  });
  const provenance = buildProvenanceGraph({
    snapshot,
    twinState: run.twinState,
    forecast: run.forecast,
    proposal: run.proposal,
    simulation: run.simulation,
    receipt: run.receipt,
    scene: run.scene,
    renderPacket: run.renderPacket,
    collaborationEvidence: evidence,
    operatorAttention: attention,
    experimentId: run.experimentId,
  });
  const readModel = createOperatorProvenanceReadModel({ graph: provenance, attention });
  return { run, attention, provenance, readModel };
}

test('seals attention, provenance, and operator read model into one verified package', () => {
  const artifacts = fixture();
  const evidencePackage = createOperatorEvidencePackage(artifacts);

  assert.equal(validateOperatorEvidencePackage(evidencePackage, artifacts), true);
  assert.match(evidencePackage.packageFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(
    evidencePackage.manifest.attentionFingerprint,
    artifacts.attention.attentionFingerprint,
  );
  assert.equal(evidencePackage.manifest.provenanceNodeId, artifacts.readModel.provenanceNodeId);
  assert.match(evidencePackage.manifest.provenanceFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(evidencePackage.manifest.viewFingerprint, artifacts.readModel.viewFingerprint);
  assert.deepEqual(evidencePackage.safety, {
    advisoryOnly: true,
    authoritative: false,
    actuatesHardware: false,
    promotionEligible: false,
    dispatchesInfrastructure: false,
    deploysInfrastructure: false,
  });
  assert.equal(Object.isFrozen(evidencePackage), true);
  assert.equal(Object.isFrozen(evidencePackage.manifest), true);
});

test('binds package identity to the complete validated provenance graph', () => {
  const artifacts = fixture();
  const evidencePackage = createOperatorEvidencePackage(artifacts);
  const substitutedProvenance = JSON.parse(JSON.stringify(artifacts.provenance));
  substitutedProvenance.nodes[0].id = 'telemetry-substituted-lineage';
  substitutedProvenance.edges[0].from = substitutedProvenance.nodes[0].id;

  assert.equal(
    validateProvenanceGraph(substitutedProvenance, { requiredTypes: ['operator-attention'] }),
    true,
  );

  const substitutedPackage = createOperatorEvidencePackage({
    ...artifacts,
    provenance: substitutedProvenance,
  });
  assert.notEqual(
    substitutedPackage.manifest.provenanceFingerprint,
    evidencePackage.manifest.provenanceFingerprint,
  );
  assert.notEqual(substitutedPackage.packageFingerprint, evidencePackage.packageFingerprint);
  assert.equal(
    validateOperatorEvidencePackage({
      ...evidencePackage,
      provenance: substitutedProvenance,
    }),
    false,
  );
});

test('rejects a valid read model substituted from another valid experiment', () => {
  const original = fixture();
  const evidencePackage = createOperatorEvidencePackage(original);
  const substituteSnapshot = {
    ...snapshot,
    snapshotId: 'operator-package-v2',
    observedAt: '2026-09-15T00:05:00.000Z',
  };
  const substituteRun = runSyntheticMicrogrid(substituteSnapshot);
  const candidate = {
    experimentId: substituteRun.experimentId,
    snapshotId: substituteSnapshot.snapshotId,
    proposal: substituteRun.proposal,
  };
  const evidence = createSolvaerCollaborationEvidence({
    request: substituteRun.solvaerRequest,
    candidate,
    provenanceRef: {
      experimentId: substituteRun.experimentId,
      snapshotId: substituteSnapshot.snapshotId,
    },
  });
  const attention = buildSolvaerOperatorAttention({
    evidence,
    twinState: substituteRun.twinState,
    decision: {
      experimentId: substituteRun.experimentId,
      requestId: substituteRun.solvaerRequest.requestId,
      simulation: { status: 'passed' },
    },
  });
  const provenance = buildProvenanceGraph({
    snapshot: substituteSnapshot,
    twinState: substituteRun.twinState,
    forecast: substituteRun.forecast,
    proposal: substituteRun.proposal,
    simulation: substituteRun.simulation,
    receipt: substituteRun.receipt,
    scene: substituteRun.scene,
    renderPacket: substituteRun.renderPacket,
    collaborationEvidence: evidence,
    operatorAttention: attention,
    experimentId: substituteRun.experimentId,
  });
  const readModel = createOperatorProvenanceReadModel({ graph: provenance, attention });

  assert.equal(
    validateOperatorEvidencePackage(evidencePackage, {
      attention: original.attention,
      provenance: original.provenance,
      readModel,
    }),
    false,
  );
});

test('rejects manifest substitution and any attempt to widen authority', () => {
  const artifacts = fixture();
  const evidencePackage = createOperatorEvidencePackage(artifacts);

  assert.equal(
    validateOperatorEvidencePackage(
      {
        ...evidencePackage,
        manifest: { ...evidencePackage.manifest, viewFingerprint: 'a'.repeat(64) },
      },
      artifacts,
    ),
    false,
  );
  assert.equal(
    validateOperatorEvidencePackage(
      {
        ...evidencePackage,
        safety: { ...evidencePackage.safety, promotionEligible: true },
      },
      artifacts,
    ),
    false,
  );
});

test('rejects deceptive package descriptors without evaluating getters', () => {
  const artifacts = fixture();
  const evidencePackage = createOperatorEvidencePackage(artifacts);
  let getterReads = 0;
  const deceptive = { ...evidencePackage };
  Object.defineProperty(deceptive, 'packageFingerprint', {
    enumerable: true,
    get() {
      getterReads += 1;
      return evidencePackage.packageFingerprint;
    },
  });

  assert.equal(validateOperatorEvidencePackage(deceptive, artifacts), false);
  assert.equal(getterReads, 0);
});
