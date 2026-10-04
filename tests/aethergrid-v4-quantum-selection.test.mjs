import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuantumRuntime } from '../apps/aethergrid-console/quantum-runtime.mjs';

test('quantum selection: local simulator default status is ready and hardwareEnabled false', () => {
  const runtime = createQuantumRuntime({ env: {} });
  const summary = runtime.summary();

  assert.equal(summary.selectedProvider, 'local-simulator');
  assert.equal(summary.selectedProviderStatus, 'ready');
  assert.equal(summary.hardwareEnabled, false);
  assert.equal(summary.configured, true);
});

test('quantum selection: IBM with API key but missing CRN yields instance_required and hardwareEnabled false', () => {
  const runtime = createQuantumRuntime({
    env: {
      AETHERGRID_QUANTUM_PROVIDER: 'ibm-quantum',
      AETHERGRID_IBM_QUANTUM_API_KEY: 'test-fake-key',
    },
  });
  const summary = runtime.summary();

  assert.equal(summary.selectedProvider, 'ibm-quantum');
  assert.equal(summary.selectedProviderStatus, 'instance_required');
  assert.equal(summary.hardwareEnabled, false);
  assert.equal(summary.configured, false);
  assert.equal(summary.providers.ibm.apiKeyPresent, true);
  assert.equal(summary.providers.ibm.serviceCrnPresent, false);
});

test('quantum selection: IBM with API key AND CRN yields configured and hardwareEnabled true', () => {
  const runtime = createQuantumRuntime({
    env: {
      AETHERGRID_QUANTUM_PROVIDER: 'ibm-quantum',
      AETHERGRID_IBM_QUANTUM_API_KEY: 'test-fake-key',
      AETHERGRID_IBM_QUANTUM_SERVICE_CRN:
        'crn:v1:bluemix:public:quantum-computing:us-east:a/1234::',
    },
  });
  const summary = runtime.summary();

  assert.equal(summary.selectedProvider, 'ibm-quantum');
  assert.equal(summary.selectedProviderStatus, 'configured');
  assert.equal(summary.hardwareEnabled, true);
  assert.equal(summary.configured, true);
  assert.equal(summary.providers.ibm.configured, true);
});

test('quantum selection: IBM selected but unconfigured while D-Wave configured yields aggregateStatus alternate-available', () => {
  const runtime = createQuantumRuntime({
    env: {
      AETHERGRID_QUANTUM_PROVIDER: 'ibm-quantum',
      AETHERGRID_DWAVE_API_TOKEN: 'fake-dwave-token',
    },
  });
  const summary = runtime.summary();

  assert.equal(summary.selectedProvider, 'ibm-quantum');
  assert.equal(summary.selectedProviderStatus, 'unconfigured');
  assert.equal(summary.aggregateStatus, 'alternate-available');
  assert.equal(summary.alternateProviderAvailable, true);
  assert.equal(summary.alternateProvider, 'dwave');
  assert.equal(summary.hardwareEnabled, false);
});

test('quantum selection: D-Wave selected but unconfigured while IBM configured yields aggregateStatus alternate-available', () => {
  const runtime = createQuantumRuntime({
    env: {
      AETHERGRID_QUANTUM_PROVIDER: 'dwave',
      AETHERGRID_IBM_QUANTUM_API_KEY: 'test-fake-key',
      AETHERGRID_IBM_QUANTUM_SERVICE_CRN:
        'crn:v1:bluemix:public:quantum-computing:us-east:a/1234::',
    },
  });
  const summary = runtime.summary();

  assert.equal(summary.selectedProvider, 'dwave');
  assert.equal(summary.selectedProviderStatus, 'unconfigured');
  assert.equal(summary.aggregateStatus, 'alternate-available');
  assert.equal(summary.alternateProviderAvailable, true);
  assert.equal(summary.alternateProvider, 'ibm-quantum');
  assert.equal(summary.hardwareEnabled, false);
});

test('quantum selection: both hardware providers unconfigured falls back to local-simulator alternate', () => {
  const runtime = createQuantumRuntime({
    env: {
      AETHERGRID_QUANTUM_PROVIDER: 'ibm-quantum',
    },
  });
  const summary = runtime.summary();

  assert.equal(summary.selectedProvider, 'ibm-quantum');
  assert.equal(summary.selectedProviderStatus, 'unconfigured');
  assert.equal(summary.alternateProvider, 'local-simulator');
  assert.equal(summary.alternateProviderAvailable, true);
  assert.equal(summary.hardwareEnabled, false);
});
