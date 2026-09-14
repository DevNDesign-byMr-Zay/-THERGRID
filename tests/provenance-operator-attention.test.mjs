import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
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

test('chains operator attention after collaboration evidence in provenance', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const candidate = { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId, proposal: baseline.proposal };
  const provenanceRef = { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId };
  const bridge = buildSolvaerDecisionRenderBridge({ request: baseline.solvaerRequest, candidate, provenanceRef, twinState: baseline.twinState, forecast: baseline.forecast, proposal: baseline.proposal, scene: baseline.scene, presentation: baseline.presentation });
  const graph = buildProvenanceGraph({ ...baseline, receipt: baseline.receipt, collaborationEvidence: bridge.collaborationEvidence, operatorAttention: bridge.operatorAttention });
  assert.equal(validateProvenanceGraph(graph, { requiredTypes: ['render-packet', 'solvaer-collaboration', 'operator-attention'] }), true);
  assert.deepEqual(graph.nodes.map((node) => node.type).slice(-3), ['render-packet', 'solvaer-collaboration', 'operator-attention']);
  assert.equal(graph.edges.at(-1).to, graph.nodes.at(-1).id);
});

test('tampering operator attention changes its provenance artifact identity', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const evidence = createSolvaerCollaborationEvidence({ request: baseline.solvaerRequest, candidate: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId, proposal: baseline.proposal }, provenanceRef: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId } });
  const attention = { version: 1, experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId, requestId: baseline.solvaerRequest.requestId, items: [{ id: `${baseline.experimentId}:simulation`, priority: 40, severity: 'info', reason: 'simulation passed', evidenceRef: evidence.evidenceFingerprint, advisoryOnly: true }], safety: { authoritative: false, actuatesHardware: false, advisoryOnly: true } };
  const tampered = { ...attention, items: [{ ...attention.items[0], priority: 99 }] };
  const originalGraph = buildProvenanceGraph({ ...baseline, collaborationEvidence: evidence, operatorAttention: attention });
  const tamperedGraph = buildProvenanceGraph({ ...baseline, collaborationEvidence: evidence, operatorAttention: tampered });
  assert.notEqual(originalGraph.nodes.at(-1).id, tamperedGraph.nodes.at(-1).id);
});
