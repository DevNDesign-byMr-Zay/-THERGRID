import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createQuantumWorkerClient } from '../apps/aethergrid-console/quantum/quantum-worker-client.mjs';

const BELL_STATE_QASM = `
OPENQASM 3.0;
include "stdgates.inc";
qubit[2] q;
bit[2] c;
h q[0];
cx q[0], q[1];
c[0] = measure q[0];
c[1] = measure q[1];
`;

describe('ÆTHERGRID v4.0 IBM Qiskit Quantum Worker Integration', () => {
  it('validates and formats prepare request through quantum worker client', async () => {
    const mockFetchFn = async (url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.backend, 'ibm_sherbrooke');
      assert.equal(body.primitive, 'sampler');
      return {
        json: async () => ({
          state: 'PREPARED',
          backend: 'ibm_sherbrooke',
          primitive: 'sampler',
          optimizationLevel: 2,
          shots: 4096,
          abstractQasm: BELL_STATE_QASM,
          isaQasm: 'OPENQASM 3.0; // transpiled',
          metrics: {
            logicalQubits: 2,
            physicalQubits: 127,
            depthBefore: 2,
            depthAfter: 10,
            twoQubitDepthBefore: 1,
            twoQubitDepthAfter: 2,
            gateCountBefore: 3,
            gateCountAfter: 15,
          },
          hardwareCompatible: true,
          pubPayload: { circuit: 'OPENQASM 3.0;', shots: 4096 },
          receipt: 'sha256:1234567890abcdef',
        }),
      };
    };

    const client = createQuantumWorkerClient({ fetchFn: mockFetchFn });
    const prep = await client.prepare({
      provider: 'ibm-quantum',
      backend: 'ibm_sherbrooke',
      primitive: 'sampler',
      workload: {
        type: 'openqasm3',
        circuit: BELL_STATE_QASM,
      },
      optimizationLevel: 2,
      shots: 4096,
    });

    assert.equal(prep.state, 'PREPARED');
    assert.equal(prep.hardwareCompatible, true);
    assert.equal(prep.metrics.logicalQubits, 2);
  });

  it('validates and formats dry-run request without claiming hardware execution', async () => {
    const mockFetchFn = async (url, options) => {
      return {
        json: async () => ({
          state: 'DRY_RUN_VALIDATED',
          backend: 'ibm_sherbrooke',
          primitive: 'sampler',
          hardwareCompatible: true,
          dryRunSubmitted: true,
          dryRunValidated: true,
          preparation: { state: 'PREPARED' },
          ibmValidationStatus: 'VALIDATED_PREFLIGHT',
          receipt: 'sha256:dryrun123456',
        }),
      };
    };

    const client = createQuantumWorkerClient({ fetchFn: mockFetchFn });
    const dry = await client.dryRun({
      provider: 'ibm-quantum',
      backend: 'ibm_sherbrooke',
      primitive: 'sampler',
      workload: {
        type: 'openqasm3',
        circuit: BELL_STATE_QASM,
      },
      optimizationLevel: 2,
      shots: 4096,
    });

    assert.equal(dry.state, 'DRY_RUN_VALIDATED');
    assert.equal(dry.dryRunValidated, true);
  });
});
