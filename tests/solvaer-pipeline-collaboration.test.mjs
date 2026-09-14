import { describe, expect, it } from 'vitest';
import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { evaluateSolvaerDecisionHandoff } from '../src/solvaer-decision-handoff.mjs';
import { validateSolvaerCollaborationResult } from '../src/solvaer-collaboration-validator.mjs';

describe('THERGRID pipeline to SOLVÆR collaboration seam', () => {
  const snapshot = {
    snapshotId: 'collab-snapshot-1',
    observedAt: '2026-09-14T00:00:00.000Z',
    nodes: [
      { id: 'node-a', loadKw: 10, generationKw: 12 },
      { id: 'node-b', loadKw: 8, generationKw: 7 },
    ],
  };

  it('anchors a SOLVÆR candidate to the pipeline experiment and routes it back through simulation evidence', () => {
    const baseline = runSyntheticMicrogrid(snapshot);
    expect(validateSolvaerCollaborationResult({
      request: baseline.solvaerRequest,
      candidate: {
        experimentId: baseline.experimentId,
        snapshotId: snapshot.snapshotId,
        proposal: baseline.proposal,
      },
      provenanceRef: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId },
    })).toBe(true);

    const handoff = evaluateSolvaerDecisionHandoff({
      request: baseline.solvaerRequest,
      candidate: {
        experimentId: baseline.experimentId,
        snapshotId: snapshot.snapshotId,
        proposal: baseline.proposal,
      },
      provenanceRef: { experimentId: baseline.experimentId, snapshotId: snapshot.snapshotId },
      twinState: baseline.twinState,
      forecast: baseline.forecast,
      proposal: baseline.proposal,
    });

    expect(handoff.experimentId).toBe(baseline.experimentId);
    expect(handoff.simulation.status).toBe('passed');
    expect(handoff.promotionEligible).toBe(false);
    expect(handoff.handoff).toBe('simulation-evidence-required');
    expect(handoff.safety).toEqual({ advisoryOnly: true, authoritative: false, actuatesHardware: false });
  });
});
