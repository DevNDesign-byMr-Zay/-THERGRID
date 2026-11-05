import assert from 'node:assert/strict';
import test from 'node:test';
import { createQuantumRuntime } from '../apps/aethergrid-console/quantum-runtime.mjs';
import {
  verifyLocalQuantum,
  evaluateProviderAcceptance,
} from '../scripts/lib/canonical-quantum-policy.mjs';

const names = [
  'groq-VÆLON',
  'groq-AUREN',
  'groq-SOLVÆR',
  'groq-TEAM',
  'tomorrow-current',
  'tomorrow-forecast',
  'eia-NYIS',
  'noaa-BATN6',
  'transitland',
  'nyc-ferry-GTFS',
  'local-quantum',
];
const providers = () => Object.fromEntries(names.map((name) => [name, { verified: true }]));

test('local acceptance executes the maintained analytic sampler and estimator without network', async () => {
  const runtime = createQuantumRuntime({
    env: {},
    fetchImpl: () => {
      throw new Error('network forbidden');
    },
  });
  const result = await verifyLocalQuantum(runtime);
  assert.equal(result.verified, true);
  assert.equal(result.hardwareExecuted, false);
  assert.equal(result.provider, 'local-simulator');
  assert.equal(result.acceptanceState, 'local-analytic-simulation-verified');
});

test('local acceptance rejects incorrect sampler results and hardware claims', async () => {
  for (const change of [
    { distribution: { '00': 1024 } },
    { hardwareExecuted: true },
    { hardwareSubmitted: true },
    { provider: 'ibm-quantum' },
  ]) {
    const real = createQuantumRuntime({ env: {} });
    const runtime = {
      ...real,
      submitSampler: async (input) => ({ ...(await real.submitSampler(input)), ...change }),
    };
    assert.equal((await verifyLocalQuantum(runtime)).verified, false);
  }
});

test('software profile accepts verified local execution while reporting IBM as unverified', () => {
  const result = evaluateProviderAcceptance(
    { ...providers(), ibm: { verified: false, state: 'not-requested' } },
    'local-simulator',
  );
  assert.equal(result.passed, true);
  assert.equal(result.ibmVerified, false);
  assert.equal(result.hardwareExecuted, false);
});

test('software profile still rejects any missing or failed required provider', () => {
  for (const name of names) {
    const input = providers();
    delete input[name];
    assert.equal(evaluateProviderAcceptance(input, 'local-simulator').passed, false);
    input[name] = { verified: false };
    assert.equal(evaluateProviderAcceptance(input, 'local-simulator').passed, false);
  }
  assert.equal(evaluateProviderAcceptance({}, 'local-simulator').passed, false);
});

test('default strict profile continues to require authenticated IBM discovery', () => {
  assert.equal(evaluateProviderAcceptance(providers()).passed, false);
  assert.equal(
    evaluateProviderAcceptance({ ...providers(), ibm: { verified: true } }).passed,
    true,
  );
});

test('unknown acceptance profiles fail closed', () => {
  assert.throws(() => evaluateProviderAcceptance(providers(), 'skip-everything'), /profile/);
});
