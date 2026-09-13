import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDecisionReceipt, fingerprintDecisionReceipt } from '../src/decision-receipt.mjs';
import { buildVaelonAurenEvidenceHandoff } from '../src/model-evidence-handoff.mjs';
import { createModelRoute } from '../src/model-routing.mjs';
import { buildSolverEvidence, fingerprintSolverEvidence } from '../src/solver-evaluation.mjs';

function receipt(snapshotId = 'snapshot-001') {
  return buildDecisionReceipt({
    twinState: { snapshotId, observedAt: '2026-09-13T00:00:00.000Z' },
    forecast: {
      snapshotId,
      forecastFor: '2026-09-13T00:15:00.000Z',
      method: 'deterministic-test',
      horizonMinutes: 15,
      generationKw: 42,
      loadKw: 40,
    },
    proposal: {
      snapshotId,
      forecastFor: '2026-09-13T00:15:00.000Z',
      strategy: 'hold',
      projectedBalanceKw: 2,
      action: { kind: 'none', adjustmentKw: 0, targetKw: 0 },
      advisoryOnly: true,
    },
  });
}

function solverEvidence(snapshotId = 'snapshot-001', fallback = null) {
  return buildSolverEvidence({
    experimentId: 'experiment-001',
    inputSnapshotId: snapshotId,
    candidate: { model: 'quantum-inspired', solver: 'bounded-search', version: 'v1' },
    constraints: { maxIterations: 64 },
    seed: 7,
    objective: 1.25,
    feasible: true,
    runtimeMs: 12,
    timeout: false,
    fallback,
    provenance: [`snapshot:${snapshotId}`, 'solver:bounded-search:v1'],
  });
}

test('binds VÆLON evidence to the canonical solver and decision receipt fingerprints', () => {
  const decisionReceipt = receipt();
  const evidence = solverEvidence();
  const route = createModelRoute({ model: 'VÆLON', version: 'v2' });

  const handoff = buildVaelonAurenEvidenceHandoff({
    requestId: 'request-001',
    route,
    solverEvidence: evidence,
    decisionReceipt,
  });

  assert.equal(handoff.requestId, 'request-001');
  assert.equal(handoff.snapshotId, 'snapshot-001');
  assert.equal(handoff.routing.capability, 'optimization.explore');
  assert.equal(handoff.routing.model, 'VÆLON');
  assert.equal(handoff.decisionReceiptFingerprint, fingerprintDecisionReceipt(decisionReceipt));
  assert.equal(handoff.solverEvidenceFingerprint, fingerprintSolverEvidence(evidence));
  assert.equal(handoff.safety.observationalOnly, true);
  assert.equal(handoff.safety.authoritative, false);
  assert.equal(handoff.safety.physicalActuation, false);
});

test('fails closed when receipt and solver evidence describe different snapshots', () => {
  assert.throws(
    () =>
      buildVaelonAurenEvidenceHandoff({
        requestId: 'request-002',
        route: createModelRoute({ model: 'VÆLON', version: 'v2' }),
        solverEvidence: solverEvidence('snapshot-002'),
        decisionReceipt: receipt('snapshot-001'),
      }),
    /snapshotId must match/,
  );
});

test('rejects non-VÆLON routes and preserves fallback disclosure', () => {
  const evidence = solverEvidence('snapshot-001', 'classical-reference-v1');
  const decisionReceipt = receipt();

  assert.throws(
    () =>
      buildVaelonAurenEvidenceHandoff({
        requestId: 'request-003',
        route: createModelRoute({ model: 'AUREN', version: 'v1' }),
        solverEvidence: evidence,
        decisionReceipt,
      }),
    /must use the VÆLON route/,
  );

  const handoff = buildVaelonAurenEvidenceHandoff({
    requestId: 'request-004',
    route: createModelRoute({ model: 'VÆLON', version: 'v2' }),
    solverEvidence: evidence,
    decisionReceipt,
  });

  assert.equal(handoff.routing.fallbackUsed, true);
  assert.equal(handoff.routing.fallbackIdentity, 'classical-reference-v1');
  assert.equal(handoff.solver.fallback, 'classical-reference-v1');
});
