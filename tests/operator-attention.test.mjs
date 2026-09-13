import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDecisionReceipt } from '../src/decision-receipt.mjs';
import { buildVaelonAurenEvidenceHandoff } from '../src/model-evidence-handoff.mjs';
import { createModelRoute } from '../src/model-routing.mjs';
import {
  buildOperatorAttentionProjection,
  SUPPORTED_TARGETS,
  validateOperatorAttentionProjection,
} from '../src/operator-attention.mjs';
import { buildSolverEvidence } from '../src/solver-evaluation.mjs';
import { buildSpatialScene } from '../src/spatial-scene.mjs';

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

function evidence({ snapshotId = 'snapshot-001', fallback = null, timeout = false } = {}) {
  return buildSolverEvidence({
    experimentId: 'experiment-001',
    inputSnapshotId: snapshotId,
    candidate: { model: 'quantum-inspired', solver: 'bounded-search', version: 'v1' },
    constraints: { maxIterations: 64 },
    seed: 7,
    objective: 1.25,
    feasible: true,
    runtimeMs: 12,
    timeout,
    fallback,
    provenance: [`snapshot:${snapshotId}`, 'solver:bounded-search:v1'],
  });
}

function handoff(options = {}) {
  const solverEvidence = evidence(options);
  return buildVaelonAurenEvidenceHandoff({
    requestId: 'request-001',
    route: createModelRoute({ model: 'VÆLON', version: 'v2' }),
    solverEvidence,
    decisionReceipt: receipt(options.snapshotId),
  });
}

function scene(snapshotId = 'snapshot-001') {
  return buildSpatialScene({
    twinState: {
      snapshotId,
      observedAt: '2026-09-13T00:00:00.000Z',
      totals: {
        generationKw: 42,
        loadKw: 40,
        balanceKw: 2,
        renewableSharePercent: 75,
      },
    },
    provenance: { experimentId: 'experiment-001' },
  });
}

test('builds deterministic advisory projections for every renderer-neutral target', () => {
  const evidenceHandoff = handoff();
  const spatialScene = scene();

  for (const target of SUPPORTED_TARGETS) {
    const first = buildOperatorAttentionProjection({
      scene: spatialScene,
      handoff: evidenceHandoff,
      target,
    });
    const second = buildOperatorAttentionProjection({
      scene: spatialScene,
      handoff: evidenceHandoff,
      target,
    });

    assert.equal(first.projectionFingerprint, second.projectionFingerprint);
    assert.equal(first.sceneVersion, 2);
    assert.equal(first.snapshotId, 'snapshot-001');
    assert.equal(first.target.name, target);
    assert.equal(first.target.rendererNeutral, true);
    assert.equal(first.attention[0].advisoryOnly, true);
    assert.equal(first.advisoryOnly, true);
    assert.equal(first.authoritative, false);
    assert.equal(first.physicalActuation, false);
    assert.equal(validateOperatorAttentionProjection(first), true);
  }
});

test('preserves fallback disclosure as deterministic operator attention', () => {
  const projection = buildOperatorAttentionProjection({
    scene: scene(),
    handoff: handoff({ fallback: 'classical-reference-v1' }),
    target: 'web-dashboard',
  });

  assert.equal(projection.routing.fallbackUsed, true);
  assert.equal(projection.solver.fallback, 'classical-reference-v1');
  assert.equal(projection.attention[0].id, 'solver-fallback');
  assert.equal(projection.attention[0].severity, 'warning');
  assert.match(projection.attention[0].reason, /classical-reference-v1/);
});

test('rejects mismatched scene identity and unsupported targets before projection', () => {
  assert.throws(
    () =>
      buildOperatorAttentionProjection({
        scene: scene('snapshot-002'),
        handoff: handoff({ snapshotId: 'snapshot-001' }),
        target: 'web-dashboard',
      }),
    /snapshotId must match/,
  );

  assert.throws(
    () =>
      buildOperatorAttentionProjection({
        scene: { ...scene(), sceneVersion: 99 },
        handoff: handoff(),
        target: 'web-dashboard',
      }),
    /sceneVersion must equal 2/,
  );

  assert.throws(
    () =>
      buildOperatorAttentionProjection({
        scene: scene(),
        handoff: handoff(),
        target: 'live-grid-controller',
      }),
    /unsupported operator target/,
  );
});

test('fails validation when projection identity or authority fields are tampered', () => {
  const projection = buildOperatorAttentionProjection({
    scene: scene(),
    handoff: handoff(),
    target: 'projector',
  });

  assert.throws(
    () =>
      validateOperatorAttentionProjection({
        ...projection,
        sceneId: 'scene-tampered',
      }),
    /fingerprint integrity check failed/,
  );

  assert.throws(
    () =>
      validateOperatorAttentionProjection({
        ...projection,
        sceneVersion: 99,
      }),
    /sceneVersion must equal 2/,
  );

  assert.throws(
    () =>
      validateOperatorAttentionProjection({
        ...projection,
        authoritative: true,
      }),
    /safety boundary must remain advisory-only/,
  );
});
