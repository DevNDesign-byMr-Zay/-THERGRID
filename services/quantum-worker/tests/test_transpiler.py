import pytest
from qiskit import QuantumCircuit
from qiskit.providers.fake_provider import GenericBackendV2
from transpiler import parse_openqasm3, transpile_workload

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

def test_parse_openqasm3():
    circuit = parse_openqasm3(QASM_SAMPLE)
    assert isinstance(circuit, QuantumCircuit)
    assert circuit.num_qubits == 2

def test_transpile_workload_sampler():
    circuit = parse_openqasm3(QASM_SAMPLE)
    backend = GenericBackendV2(num_qubits=20)
    isa_circuit, metrics, obs = transpile_workload(
        circuit=circuit,
        backend_target=backend.target,
        optimization_level=2
    )
    assert isa_circuit.num_qubits == 20
    assert metrics.logicalQubits == 2
    assert metrics.physicalQubits == 20
    assert obs is None

def test_transpile_workload_estimator_observable_layout():
    circuit = parse_openqasm3(QASM_SAMPLE)
    backend = GenericBackendV2(num_qubits=20)
    isa_circuit, metrics, obs = transpile_workload(
        circuit=circuit,
        backend_target=backend.target,
        optimization_level=2,
        observables=["ZZ"]
    )
    assert obs is not None
    assert len(obs) == 1
    assert obs[0].num_qubits == 20
