import { describe, expect, it } from 'vitest';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';

describe('SOLVÆR pipeline handoff', () => {
  it('emits an advisory optimization request anchored to the experiment', () => {
    const result = runSyntheticMicrogrid({
      snapshotId: 'snapshot-solvaer-001',
      observedAt: '2026-09-13T18:00:00Z',
      assets: [
        { id: 'solar-1', generationKw: 80, loadKw: 0 },
        { id: 'load-1', generationKw: 0, loadKw: 60 },
      ],
    });

    expect(result.solvaerRequest.experimentId).toBe(result.experimentId);
    expect(result.solvaerRequest.snapshotId).toBe(result.twinState.snapshotId);
    expect(result.solvaerRequest.safety).toEqual({ advisoryOnly: true, authoritative: false, actuatesHardware: false });
  });
});
