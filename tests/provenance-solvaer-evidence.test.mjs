import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { createSolvaerCollaborationEvidence } from '../src/solvaer-collaboration-evidence.mjs';
import { buildProvenanceGraph, validateProvenanceGraph } from '../src/provenance.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'provenance-solvaer-v1',
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

test('chains validated SOLVÆR collaboration evidence after render evidence', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const candidate = { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId, proposal: baseline.proposal };
  const provenanceRef = { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId };
  const evidence = createSolvaerCollaborationEvidence({ request: baseline.solvaerRequest, candidate, provenanceRef });
  const graph = buildProvenanceGraph({ ...baseline, receipt: baseline.receipt, collaborationEvidence: evidence });
  assert.equal(validateProvenanceGraph(graph, { requiredTypes: ['render-packet', 'solvaer-collaboration'] }), true);
  const types = graph.nodes.map((node) => node.type);
  assert.deepEqual(types.slice(-2), ['render-packet', 'solvaer-collaboration']);
  assert.equal(graph.edges.at(-1).to, graph.nodes.at(-1).id);
});

test('tampered collaboration evidence still produces an identifiable but independently invalid artifact', () => {
  const baseline = runSyntheticMicrogrid(snapshot);
  const evidence = createSolvaerCollaborationEvidence({
    request: baseline.solvaerRequest,
    candidate: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId, proposal: baseline.proposal },
    provenanceRef: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId },
  });
  const tampered = { ...evidence, handoff: 'direct-execution' };
  const graph = buildProvenanceGraph({ ...baseline, receipt: baseline.receipt, collaborationEvidence: tampered });
  assert.equal(graph.nodes.at(-1).type, 'solvaer-collaboration');
  assert.notEqual(graph.nodes.at(-1).id, `solvaer-collaboration-${evidence.evidenceFingerprint.slice(0, 16)}`);
});
