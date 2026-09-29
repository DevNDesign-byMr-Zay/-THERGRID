import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createOperatorConsoleCapabilities,
  OPERATOR_CONSOLE_CAPABILITIES_VERSION,
} from '../src/operator-console-capabilities.mjs';

test('operator console capabilities expose the real ÆTHERGRID product pillars', () => {
  const capabilities = createOperatorConsoleCapabilities();

  assert.equal(capabilities.version, OPERATOR_CONSOLE_CAPABILITIES_VERSION);
  assert.equal(capabilities.product, 'ÆTHERGRID');
  assert.equal(capabilities.digitalTwin.state, 'implemented');
  assert.equal(capabilities.ai.state, 'advisory');
  assert.equal(capabilities.quantum.classicalBaselineRequired, true);
  assert.equal(capabilities.holographic.state, 'renderer-neutral');
  assert.equal(capabilities.evidence.state, 'implemented');
});

test('operator console capabilities preserve the no-actuation authority boundary', () => {
  const capabilities = createOperatorConsoleCapabilities();

  assert.equal(capabilities.safety.advisoryOnly, true);
  assert.equal(capabilities.safety.authoritative, false);
  assert.equal(capabilities.safety.actuatesHardware, false);
  assert.equal(capabilities.holographic.authoritative, false);
  assert.equal(capabilities.holographic.actuatesHardware, false);
});

test('operator console exposes the existing AI, quantum-inspired, and holographic seams', () => {
  const capabilities = createOperatorConsoleCapabilities();

  assert.deepEqual(
    capabilities.ai.models.map((model) => model.id),
    ['VÆLON', 'AUREN', 'SOLVÆR'],
  );
  assert.match(capabilities.quantum.localQuantumInspiredBackend, /^thergrid-qis-/);
  assert.match(capabilities.quantum.localQuantumInspiredAlgorithm, /qubo/);
  assert.ok(capabilities.holographic.supportedTargets.includes('web-dashboard'));
  assert.ok(capabilities.holographic.supportedTargets.includes('volumetric-3d'));
});

test('operator console capability snapshot is deeply frozen', () => {
  const capabilities = createOperatorConsoleCapabilities();

  assert.equal(Object.isFrozen(capabilities), true);
  assert.equal(Object.isFrozen(capabilities.ai.models), true);
  assert.equal(Object.isFrozen(capabilities.quantum.progression), true);
});
