import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { buildSolvaerDecisionRenderBridge } from '../src/solvaer-decision-render-bridge.mjs';
import { buildProvenanceGraph, validateProvenanceGraph } from '../src/provenance.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'provenance-attention-v1',
  observedAt: '2026-09-13T00:00:00.000Z',
  assets: [
    { id: 'solar-1', kind: 'solar', powerKw: 40, capacityKw: 50 },
    { id: 'load-1', kind: 'load', powerKw: 35, flexible: true },
    { id: 'grid-1', kind: 'grid_interconnect', powerKw: -5, importLimitKw: 80, exportLimitKw: 40 },
  ],
  topology: { nodes: ['node-a'], connections: [
    { assetId: 'solar-1', nodeId: 'node-a' },
    { assetId: 'load-1', nodeId: 'node-a' },
    { assetId: 'grid-1', nodeId: 'node-a' },
  ] },
};

function fixture() {
  const baseline = runSyntheticMicrogrid(snapshot);
  const candidate = { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId, proposal: baseline.proposal };
  const provenanceRef = { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId };
  const bridge = buildSolvaerDecisionRenderBridge({ request: baseline.solvaerRequest, candidate, provenanceRef, twinState: baseline.twinState, forecast: baseline.forecast, proposal: baseline.proposal, scene: baseline.scene, presentation: baseline.presentation });
  return { baseline, bridge };
}

test('chains sealed operator attention after collaboration evidence in provenance', () => {
  const { baseline, bridge } = fixture();
  const graph = buildProvenanceGraph({ ...baseline, receipt: baseline.receipt, collaborationEvidence: bridge.collaborationEvidence, operatorAttention: bridge.operatorAttention });
  assert.equal(validateProvenanceGraph(graph, { requiredTypes: ['render-packet', 'solvaer-collaboration', 'operator-attention'] }), true);
  assert.deepEqual(graph.nodes.map((node) => node.type).slice(-3), ['render-packet', 'solvaer-collaboration', 'operator-attention']);
  const attentionNode = graph.nodes.at(-1);
  assert.equal(attentionNode.sourceFingerprint, bridge.operatorAttention.attentionFingerprint);
  assert.equal(attentionNode.id, `operator-attention-${bridge.operatorAttention.attentionFingerprint.slice(0, 16)}`);
  assert.equal(graph.edges.at(-1).to, attentionNode.id);
});

test('rejects tampered or unsealed operator attention before provenance projection', () => {
  const { baseline, bridge } = fixture();
  const tampered = {
    ...bridge.operatorAttention,
    items: [{ ...bridge.operatorAttention.items[0], priority: 99 }, bridge.operatorAttention.items[1]],
  };
  assert.throws(
    () => buildProvenanceGraph({ ...baseline, collaborationEvidence: bridge.collaborationEvidence, operatorAttention: tampered }),
    /must be sealed/,
  );

  const unsealed = { ...bridge.operatorAttention };
  delete unsealed.attentionFingerprint;
  assert.throws(
    () => buildProvenanceGraph({ ...baseline, collaborationEvidence: bridge.collaborationEvidence, operatorAttention: unsealed }),
    /must be sealed/,
  );
});

test('provenance validation rejects substituted operator attention fingerprint identity', () => {
  const { baseline, bridge } = fixture();
  const graph = buildProvenanceGraph({ ...baseline, collaborationEvidence: bridge.collaborationEvidence, operatorAttention: bridge.operatorAttention });
  const nodes = graph.nodes.map((node) => ({ ...node }));
  const attentionNode = nodes.at(-1);
  attentionNode.sourceFingerprint = 'f'.repeat(64);

  assert.equal(validateProvenanceGraph({ ...graph, nodes }, { requiredTypes: ['operator-attention'] }), false);
});
