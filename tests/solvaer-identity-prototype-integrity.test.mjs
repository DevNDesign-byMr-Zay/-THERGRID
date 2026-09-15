import assert from 'node:assert/strict';
import { createSolvaerOptimizationRequest, acceptSolvaerOptimizationResult, SOLVAER_PRODUCER_IDENTITY } from '../src/solvaer-optimization-contract.mjs';

const request = createSolvaerOptimizationRequest({
  experimentId: 'exp-prototype',
  snapshotId: 'snap-prototype',
  twinStateRef: 'twin-state:snap-prototype',
  objective: 'minimize thermal load',
});

const provenance = { experimentId: 'exp-prototype', snapshotId: 'snap-prototype' };

function inheritedIdentity() {
  return Object.create(SOLVAER_PRODUCER_IDENTITY);
}

test('rejects a request whose SOLVÆR identity is inherited from a prototype', () => {
  assert.throws(
    () => acceptSolvaerOptimizationResult({
      request: { ...request, producerIdentity: inheritedIdentity() },
      candidate: { experimentId: 'exp-prototype', snapshotId: 'snap-prototype', proposal: {} },
      provenanceRef: provenance,
    }),
    /request producer identity is invalid/,
  );
});

test('rejects a candidate whose SOLVÆR identity is inherited from a prototype', () => {
  assert.throws(
    () => acceptSolvaerOptimizationResult({
      request,
      candidate: { experimentId: 'exp-prototype', snapshotId: 'snap-prototype', proposal: {}, producerIdentity: inheritedIdentity() },
      provenanceRef: provenance,
    }),
    /candidate producer identity does not match SOLVÆR request/,
  );
});

test('rejects provenance whose SOLVÆR identity is inherited from a prototype', () => {
  assert.throws(
    () => acceptSolvaerOptimizationResult({
      request,
      candidate: { experimentId: 'exp-prototype', snapshotId: 'snap-prototype', proposal: {} },
      provenanceRef: { ...provenance, producerIdentity: inheritedIdentity() },
    }),
    /provenanceRef producer identity does not match SOLVÆR request/,
  );
});

test('rejects a request carrying physical or authoritative execution authority', () => {
  assert.throws(
    () => acceptSolvaerOptimizationResult({
      request: { ...request, safety: { advisoryOnly: true, authoritative: true, actuatesHardware: false } },
      candidate: { experimentId: 'exp-prototype', snapshotId: 'snap-prototype', proposal: {} },
      provenanceRef: provenance,
    }),
    /request cannot carry physical or authoritative execution authority/,
  );
});

test('rejects prototype-backed candidate objects before inherited fields can satisfy contract checks', () => {
  const candidate = Object.create({
    experimentId: 'exp-prototype',
    snapshotId: 'snap-prototype',
    proposal: {},
  });
  assert.throws(
    () => acceptSolvaerOptimizationResult({ request, candidate, provenanceRef: provenance }),
    /candidate must be a plain object/,
  );
});

test('rejects prototype-backed provenance objects before inherited identifiers can satisfy the binding', () => {
  const provenanceRef = Object.create({
    experimentId: 'exp-prototype',
    snapshotId: 'snap-prototype',
  });
  assert.throws(
    () => acceptSolvaerOptimizationResult({
      request,
      candidate: { experimentId: 'exp-prototype', snapshotId: 'snap-prototype', proposal: {} },
      provenanceRef,
    }),
    /provenanceRef must be a plain object/,
  );
});

test('rejects prototype-backed safety objects before inherited authority flags are trusted', () => {
  const candidate = {
    experimentId: 'exp-prototype',
    snapshotId: 'snap-prototype',
    proposal: {},
    safety: Object.create({ authoritative: false, physicalActuation: false, advisoryOnly: true }),
  };
  assert.throws(
    () => acceptSolvaerOptimizationResult({ request, candidate, provenanceRef: provenance }),
    /candidate\.safety must be a plain object/,
  );
});
