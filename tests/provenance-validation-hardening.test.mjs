import test from 'node:test';
import assert from 'node:assert/strict';

import { validateProvenanceGraph } from '../src/provenance.mjs';

const valid = {
  contractVersion: 2,
  experimentId: 'experiment-001',
  nodes: [
    { type: 'telemetry', id: 'telemetry-a' },
    { type: 'render-packet', id: 'render-a' },
  ],
  edges: [{ from: 'telemetry-a', to: 'render-a' }],
};

test('accepts a well-formed provenance graph with required renderer evidence', () => {
  assert.equal(validateProvenanceGraph(valid, { requiredTypes: ['telemetry', 'render-packet'] }), true);
});

test('rejects malformed experiment identity', () => {
  assert.equal(validateProvenanceGraph({ ...valid, experimentId: '   ' }), false);
  assert.equal(validateProvenanceGraph({ ...valid, experimentId: 42 }), false);
});

test('rejects malformed or self-referential edges', () => {
  assert.equal(validateProvenanceGraph({ ...valid, edges: [{ from: 'missing', to: 'render-a' }] }), false);
  assert.equal(validateProvenanceGraph({ ...valid, edges: [{ from: 'render-a', to: 'render-a' }] }), false);
});

test('rejects malformed and duplicate nodes', () => {
  assert.equal(validateProvenanceGraph({ ...valid, nodes: [{ type: 'telemetry', id: '' }] }), false);
  assert.equal(validateProvenanceGraph({ ...valid, nodes: [...valid.nodes, { type: 'other', id: 'telemetry-a' }] }), false);
});
