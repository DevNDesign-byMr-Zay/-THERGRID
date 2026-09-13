import { describe, expect, it } from 'vitest';
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

    expect(validateProvenanceGraph(graph, { requiredTypes: ['spatial-scene', 'render-packet'] })).toBe(true);
    expect(graph.nodes.at(-1).type).toBe('render-packet');
    expect(graph.edges.at(-1).to).toBe(graph.nodes.at(-1).id);
  });
});
