import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildProvenanceGraph, validateProvenanceGraph } from '../src/provenance.mjs';

describe('renderer provenance graph', () => {
  it('tracks render packets as the final presentation artifact', () => {
    const graph = buildProvenanceGraph({
      snapshot: { snapshotId: 's1' },
      twinState: { snapshotId: 's1' },
      forecast: { horizon: 1 },
      proposal: { strategy: 'reference' },
      simulation: { status: 'passed' },
      receipt: { receiptId: 'r1' },
      scene: { sceneId: 'scene-1' },
      renderPacket: { sceneId: 'scene-1', checksum: 'abc' },
      experimentId: 'experiment-1',
    });

    assert.equal(
      validateProvenanceGraph(graph, {
        requiredTypes: ['spatial-scene', 'render-packet'],
      }),
      true,
    );
    assert.equal(graph.nodes.at(-1).type, 'render-packet');
    assert.equal(graph.edges.at(-1).to, graph.nodes.at(-1).id);
  });
});
