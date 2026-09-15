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
