import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createOperatorConsoleState,
  OPERATOR_CONSOLE_STATE_VERSION,
} from '../src/operator-console-state.mjs';
import { validateHolographicRenderPacket } from '../src/holographic-renderer-contract.mjs';

test('ÆTHERGRID operator state is composed from the validated synthetic pipeline', () => {
  const state = createOperatorConsoleState();

  assert.equal(state.version, OPERATOR_CONSOLE_STATE_VERSION);
  assert.equal(state.source.kind, 'validated-synthetic-demo');
  assert.equal(state.source.liveTelemetry, false);
  assert.equal(state.twin.snapshotId, state.source.snapshotId);
  assert.equal(state.twin.totals.generationKw, 60);
  assert.equal(state.twin.totals.loadKw, 45);
  assert.equal(state.twin.totals.balanceKw, 0);
  assert.equal(state.twin.assetStates.length, 5);
  assert.equal(state.spatialScene.evidence.powerFlows.length, 5);
});

test('ÆTHERGRID operator state carries validated SOLVÆR projection and attention evidence', () => {
  const state = createOperatorConsoleState();

  assert.equal(state.simulation.status, 'passed');
  assert.equal(state.simulation.operatorProjection.interpretation, 'operator-review-only');
  assert.equal(state.simulation.operatorProjection.promotionEligible, false);
  assert.equal(state.dashboard.items.length, 2);
  assert.equal(state.evidence.operatorItems.length, 2);
  assert.match(state.evidence.packageFingerprint, /^[a-f0-9]{64}$/u);
  assert.match(state.evidence.attentionFingerprint, /^[a-f0-9]{64}$/u);
  assert.match(state.evidence.provenanceFingerprint, /^[a-f0-9]{64}$/u);
  assert.match(state.evidence.viewFingerprint, /^[a-f0-9]{64}$/u);
});

test('ÆTHERGRID operator state recompiles the holographic packet with operator attention', () => {
  const state = createOperatorConsoleState();
  const packet = state.holographic.renderPacket;

  assert.equal(state.holographic.presentation.target, 'web-dashboard');
  assert.equal(state.holographic.presentation.deviceId, 'aethergrid-web-console');
  assert.equal(packet.target, 'web-dashboard');
  assert.equal(packet.deviceId, 'aethergrid-web-console');
  assert.equal(packet.operatorAttentionFingerprint, state.evidence.attentionFingerprint);
  assert.equal(packet.layers.attention.length, 2);
  assert.equal(validateHolographicRenderPacket(packet), true);
});

test('ÆTHERGRID operator state remains advisory-only and deeply immutable', () => {
  const state = createOperatorConsoleState();

  assert.equal(state.safety.advisoryOnly, true);
  assert.equal(state.safety.authoritative, false);
  assert.equal(state.safety.actuatesHardware, false);
  assert.equal(state.safety.dispatchesInfrastructure, false);
  assert.equal(state.safety.deploysInfrastructure, false);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.twin.assetStates), true);
  assert.equal(Object.isFrozen(state.holographic.renderPacket), true);
});
