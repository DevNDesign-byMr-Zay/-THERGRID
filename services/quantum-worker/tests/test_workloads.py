from schemas import PrepareRequest, WorkloadSpec
from workloads import prepare_quantum_workload
from qiskit.providers.fake_provider import GenericBackendV2

QASM_SAMPLE = """
OPENQASM 3.0;
include "stdgates.inc";
qubit[2] q;
bit[2] c;
h q[0];
cx q[0], q[1];
c[0] = measure q[0];
c[1] = measure q[1];
"""

def test_prepare_quantum_workload_sampler():
    req = PrepareRequest(
        backend="ibm_brisbane",
        primitive="sampler",
        workload=WorkloadSpec(type="openqasm3", circuit=QASM_SAMPLE),
        optimizationLevel=2,
        shots=4096
    )
    backend = GenericBackendV2(num_qubits=20)
    res = prepare_quantum_workload(req, backend.target)
    assert res["state"] == "PREPARED"
    assert res["hardwareCompatible"] is True
    assert "sha256:" in res["receipt"]
    assert res["pubPayload"]["shots"] == 4096

def test_prepare_quantum_workload_estimator():
    req = PrepareRequest(
        backend="ibm_brisbane",
        primitive="estimator",
        workload=WorkloadSpec(type="openqasm3", circuit=QASM_SAMPLE, observables=["ZZ"]),
        optimizationLevel=2,
        shots=4096
    )
    backend = GenericBackendV2(num_qubits=20)
    res = prepare_quantum_workload(req, backend.target)
    assert res["state"] == "PREPARED"
    assert "observables" in res["pubPayload"]
