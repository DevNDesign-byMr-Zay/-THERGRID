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
  assert.equal(
    validateProvenanceGraph({
      ...valid,
      nodes: [...valid.nodes, { type: 'other', id: 'telemetry-a' }],
    }),
    false,
  );
});

test('rejects graph accessors without executing getters', () => {
  let getterReads = 0;
  const graph = { ...valid };
  Object.defineProperty(graph, 'experimentId', {
    enumerable: true,
    get() {
      getterReads += 1;
      return valid.experimentId;
    },
  });

  assert.equal(validateProvenanceGraph(graph), false);
  assert.equal(getterReads, 0);
});

test('rejects hidden, symbolic, and alternate-prototype graph fields', () => {
  const hidden = { ...valid };
  Object.defineProperty(hidden, 'shadowControl', {
    enumerable: false,
    value: true,
  });
  assert.equal(validateProvenanceGraph(hidden), false);

  assert.equal(validateProvenanceGraph({ ...valid, [Symbol('shadow')]: true }), false);

  const inherited = Object.assign(Object.create({ authoritative: true }), valid);
  assert.equal(validateProvenanceGraph(inherited), false);
});

test('rejects node and edge side-channel fields', () => {
  assert.equal(
    validateProvenanceGraph({
      ...valid,
      nodes: [{ ...valid.nodes[0], controlPayload: true }, valid.nodes[1]],
    }),
    false,
  );
  assert.equal(
    validateProvenanceGraph({
      ...valid,
      edges: [{ ...valid.edges[0], dispatchDeltaKw: 1 }],
    }),
    false,
  );
});

test('rejects sparse or decorated graph arrays', () => {
  const sparseNodes = [...valid.nodes];
  delete sparseNodes[0];
  assert.equal(validateProvenanceGraph({ ...valid, nodes: sparseNodes }), false);

  const decoratedEdges = [...valid.edges];
  decoratedEdges.shadow = true;
  assert.equal(validateProvenanceGraph({ ...valid, edges: decoratedEdges }), false);
});

test('rejects node accessors without evaluating them', () => {
  let getterReads = 0;
  const node = { id: 'telemetry-a' };
  Object.defineProperty(node, 'type', {
    enumerable: true,
    get() {
      getterReads += 1;
      return 'telemetry';
    },
  });

  assert.equal(
    validateProvenanceGraph({
      ...valid,
      nodes: [node, valid.nodes[1]],
    }),
    false,
  );
  assert.equal(getterReads, 0);
});
