import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { buildProvenanceGraph, validateProvenanceGraph } from '../src/provenance.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { buildSolvaerOperatorAttention } from '../src/solvaer-operator-attention.mjs';
import {
  createOperatorProvenanceReadModel,
  validateOperatorProvenanceReadModel,
} from '../src/operator-provenance-read-model.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'operator-read-model-v1',
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
    decision: {
      experimentId: run.experimentId,
      requestId: run.solvaerRequest.requestId,
      simulation: { status: 'passed' },
    },
  });
  const graph = buildProvenanceGraph({
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
  return { run, evidence, attention, graph };
}

test('creates a deterministic read-only operator view anchored to sealed attention provenance', () => {
  const artifacts = fixture();
  const view = createOperatorProvenanceReadModel(artifacts);

  assert.equal(validateProvenanceGraph(artifacts.graph, { requiredTypes: ['operator-attention'] }), true);
  assert.match(view.viewFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(view.attentionFingerprint, artifacts.attention.attentionFingerprint);
  assert.equal(view.provenanceNodeId, `operator-attention-${artifacts.attention.attentionFingerprint.slice(0, 16)}`);
  assert.equal(view.items.length, artifacts.attention.items.length);
  assert.deepEqual(view.safety, {
    advisoryOnly: true,
    authoritative: false,
    actuatesHardware: false,
    promotionEligible: false,
  });
  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.items), true);
  assert.equal(validateOperatorProvenanceReadModel(view, artifacts), true);
});

test('rejects a graph whose otherwise valid attention node points at another fingerprint', () => {
  const artifacts = fixture();
  const view = createOperatorProvenanceReadModel(artifacts);
  const sourceFingerprint = 'a'.repeat(64);
  const originalNode = artifacts.graph.nodes.find((node) => node.type === 'operator-attention');
  const replacementId = `operator-attention-${sourceFingerprint.slice(0, 16)}`;
  const nodes = artifacts.graph.nodes.map((node) =>
    node === originalNode ? { ...node, id: replacementId, sourceFingerprint } : node,
  );
  const edges = artifacts.graph.edges.map((edge) => ({
    from: edge.from === originalNode.id ? replacementId : edge.from,
    to: edge.to === originalNode.id ? replacementId : edge.to,
  }));
  const substituted = { ...artifacts.graph, nodes, edges };

  assert.equal(validateProvenanceGraph(substituted, { requiredTypes: ['operator-attention'] }), true);
  assert.equal(
    validateOperatorProvenanceReadModel(view, { ...artifacts, graph: substituted }),
    false,
  );
  assert.throws(
    () => createOperatorProvenanceReadModel({ ...artifacts, graph: substituted }),
    /not anchored/,
  );
});

test('rejects duplicate attention nodes and authority widening in the read surface', () => {
  const artifacts = fixture();
  const view = createOperatorProvenanceReadModel(artifacts);
  const duplicateFingerprint = 'b'.repeat(64);
  const duplicateNode = {
    type: 'operator-attention',
    id: `operator-attention-${duplicateFingerprint.slice(0, 16)}`,
    sourceFingerprint: duplicateFingerprint,
  };
  const duplicateGraph = {
    ...artifacts.graph,
    nodes: [...artifacts.graph.nodes, duplicateNode],
    edges: [
      ...artifacts.graph.edges,
      { from: artifacts.graph.nodes.at(-1).id, to: duplicateNode.id },
    ],
  };

  assert.equal(validateProvenanceGraph(duplicateGraph, { requiredTypes: ['operator-attention'] }), false);
  assert.throws(
    () => createOperatorProvenanceReadModel({ ...artifacts, graph: duplicateGraph }),
    /validated operator-attention provenance/,
  );
  assert.equal(
    validateOperatorProvenanceReadModel(
      { ...view, safety: { ...view.safety, authoritative: true } },
      artifacts,
    ),
    false,
  );
});

test('rejects deceptive top-level descriptors without evaluating getters', () => {
  const artifacts = fixture();
  const view = createOperatorProvenanceReadModel(artifacts);
  let getterReads = 0;
  const deceptive = { ...view };
  Object.defineProperty(deceptive, 'viewFingerprint', {
    enumerable: true,
    get() {
      getterReads += 1;
      return view.viewFingerprint;
    },
  });

  assert.equal(validateOperatorProvenanceReadModel(deceptive, artifacts), false);
  assert.equal(getterReads, 0);
});

test('rejects extra string properties attached to the sealed items array', () => {
  const artifacts = fixture();
  const view = createOperatorProvenanceReadModel(artifacts);
  const items = view.items.map((item) => ({ ...item }));
  items.unsealedAuthority = true;
  const tampered = { ...view, items };

  assert.equal(validateOperatorProvenanceReadModel(tampered, artifacts), false);
});

test('rejects accessor side channels on the items array without evaluating them', () => {
  const artifacts = fixture();
  const view = createOperatorProvenanceReadModel(artifacts);
  const items = view.items.map((item) => ({ ...item }));
  let getterReads = 0;
  Object.defineProperty(items, 'shadowControl', {
    enumerable: true,
    get() {
      getterReads += 1;
      return true;
    },
  });
  const tampered = { ...view, items };

  assert.equal(validateOperatorProvenanceReadModel(tampered, artifacts), false);
  assert.equal(getterReads, 0);
});
