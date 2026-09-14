import { describe, expect, it } from 'vitest';
import { createSolvaerOptimizationRequest } from '../src/solvaer-optimization-contract.mjs';
import { validateSolvaerCollaborationResult } from '../src/solvaer-collaboration-validator.mjs';

describe('SOLVÆR collaboration validator', () => {
  const request = createSolvaerOptimizationRequest({
    experimentId: 'exp-1',
    snapshotId: 'snap-1',
    twinStateRef: 'twin-state:snap-1',
    objective: 'explore',
  });

  it('accepts a correctly anchored advisory candidate', () => {
    expect(validateSolvaerCollaborationResult({
      request,
      candidate: { experimentId: 'exp-1', snapshotId: 'snap-1', proposal: { dispatch: {} } },
      provenanceRef: { experimentId: 'exp-1', snapshotId: 'snap-1' },
    })).toBe(true);
  });

  it('rejects cross-snapshot candidates', () => {
    expect(validateSolvaerCollaborationResult({
      request,
      candidate: { experimentId: 'exp-1', snapshotId: 'snap-2' },
      provenanceRef: { experimentId: 'exp-1', snapshotId: 'snap-1' },
    })).toBe(false);
  });

  it('rejects authoritative or actuating candidates', () => {
    expect(validateSolvaerCollaborationResult({
      request,
      candidate: { experimentId: 'exp-1', snapshotId: 'snap-1', authoritative: true },
      provenanceRef: { experimentId: 'exp-1', snapshotId: 'snap-1' },
    })).toBe(false);
    expect(validateSolvaerCollaborationResult({
      request,
      candidate: { experimentId: 'exp-1', snapshotId: 'snap-1', actuatesHardware: true },
      provenanceRef: { experimentId: 'exp-1', snapshotId: 'snap-1' },
    })).toBe(false);
  });
});
