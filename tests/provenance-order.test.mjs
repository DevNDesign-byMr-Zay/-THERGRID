import test from 'node:test';
import assert from 'node:assert/strict';

import { validateProvenanceGraph } from '../src/provenance.mjs';

const baseGraph = {
  contractVersion: 2,
  experimentId: 'experiment-order-001',
  nodes: [
    { type: 'telemetry', id: 'telemetry-a' },
    { type: 'simulation', id: 'simulation-a' },
    { type: 'render-packet', id: 'render-a' },
  ],
  edges: [
    { from: 'telemetry-a', to: 'simulation-a' },
    { from: 'simulation-a', to: 'render-a' },
  ],
};

test('accepts the exact adjacent artifact chain', () => {
  assert.equal(validateProvenanceGraph(baseGraph), true);
});

test('rejects endpoint-valid rewiring', () => {
  assert.equal(
    validateProvenanceGraph({
      ...baseGraph,
      edges: [
        { from: 'telemetry-a', to: 'render-a' },
        { from: 'render-a', to: 'simulation-a' },
      ],
    }),
    false,
  );
});

test('rejects missing and surplus links', () => {
  assert.equal(
    validateProvenanceGraph({ ...baseGraph, edges: baseGraph.edges.slice(0, 1) }),
    false,
  );
  assert.equal(
    validateProvenanceGraph({
      ...baseGraph,
      edges: [...baseGraph.edges, { from: 'telemetry-a', to: 'render-a' }],
    }),
    false,
  );
});

test('rejects unknown or duplicate artifact types even with a valid adjacent chain', () => {
  assert.equal(
    validateProvenanceGraph({
      ...baseGraph,
      nodes: [
        { type: 'telemetry', id: 'telemetry-a' },
        { type: 'unknown-artifact', id: 'unknown-a' },
        { type: 'render-packet', id: 'render-a' },
      ],
      edges: [
        { from: 'telemetry-a', to: 'unknown-a' },
        { from: 'unknown-a', to: 'render-a' },
      ],
    }),
    false,
  );

  assert.equal(
    validateProvenanceGraph({
      ...baseGraph,
      nodes: [
        { type: 'telemetry', id: 'telemetry-a' },
        { type: 'simulation', id: 'simulation-a' },
        { type: 'simulation', id: 'simulation-b' },
      ],
      edges: [
        { from: 'telemetry-a', to: 'simulation-a' },
        { from: 'simulation-a', to: 'simulation-b' },
      ],
    }),
    false,
  );
});

test('rejects non-canonical required artifact types', () => {
  assert.equal(validateProvenanceGraph(baseGraph, { requiredTypes: ['unknown-artifact'] }), false);
});
