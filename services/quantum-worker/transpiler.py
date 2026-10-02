import hashlib
from typing import Dict, Any, List, Tuple, Optional
from qiskit import QuantumCircuit
from qiskit.qasm3 import loads as qasm3_loads, dumps as qasm3_dumps
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit.quantum_info import SparsePauliOp
from schemas import CircuitMetrics, PrepareRequest

def parse_openqasm3(qasm_str: str) -> QuantumCircuit:
    if not qasm_str or not isinstance(qasm_str, str):
        raise ValueError("OpenQASM 3 string must be a non-empty string.")
    if len(qasm_str.encode('utf-8')) > 256 * 1024:
        raise ValueError("OpenQASM 3 payload exceeds 256KB size limit.")
    try:
        return qasm3_loads(qasm_str)
    except Exception as e:
        raise ValueError(f"Failed to parse OpenQASM 3 circuit: {str(e)}")

def calculate_circuit_depths(circuit: QuantumCircuit) -> Tuple[int, int]:
    depth = circuit.depth()
    two_qubit_depth = circuit.depth(filter_function=lambda inst: inst.operation.num_qubits > 1)
    return depth, two_qubit_depth

def transpile_workload(
    circuit: QuantumCircuit,
    backend_target: Any,
    optimization_level: int = 2,
    observables: Optional[List[str]] = None
) -> Tuple[QuantumCircuit, CircuitMetrics, Optional[List[Any]]]:
    if optimization_level not in (0, 1, 2, 3):
        raise ValueError("Optimization level must be between 0 and 3.")

    depth_before, two_q_depth_before = calculate_circuit_depths(circuit)
    gate_count_before = sum(circuit.count_ops().values())
    logical_qubits = circuit.num_qubits

    pm = generate_preset_pass_manager(target=backend_target, optimization_level=optimization_level)
    isa_circuit = pm.run(circuit)

    depth_after, two_q_depth_after = calculate_circuit_depths(isa_circuit)
    gate_count_after = sum(isa_circuit.count_ops().values())
    physical_qubits = isa_circuit.num_qubits

    metrics = CircuitMetrics(
        logicalQubits=logical_qubits,
        physicalQubits=physical_qubits,
        depthBefore=depth_before,
        depthAfter=depth_after,
        twoQubitDepthBefore=two_q_depth_before,
        twoQubitDepthAfter=two_q_depth_after,
        gateCountBefore=gate_count_before,
        gateCountAfter=gate_count_after
    )

    transformed_observables = None
    if observables:
        transformed_observables = []
        for obs_str in observables:
            spo = SparsePauliOp.from_list([obs_str])
            if hasattr(isa_circuit, 'layout') and isa_circuit.layout is not None:
                spo_isa = spo.apply_layout(isa_circuit.layout)
            else:
                spo_isa = spo
            transformed_observables.append(spo_isa)

    return isa_circuit, metrics, transformed_observables

def generate_preparation_receipt(
    backend_name: str,
    primitive: str,
    optimization_level: int,
    abstract_qasm: str,
    isa_qasm: str,
    metrics: CircuitMetrics
) -> str:
    hasher = hashlib.sha256()
    hasher.update(backend_name.encode('utf-8'))
    hasher.update(primitive.encode('utf-8'))
    hasher.update(str(optimization_level).encode('utf-8'))
    hasher.update(abstract_qasm.encode('utf-8'))
    hasher.update(isa_qasm.encode('utf-8'))
    hasher.update(str(metrics.model_dump()).encode('utf-8'))
    return f"sha256:{hasher.hexdigest()}"
