from typing import Dict, Any, List, Optional
from qiskit import QuantumCircuit
from qiskit.qasm3 import dumps as qasm3_dumps
from schemas import PrepareRequest, WorkloadSpec, CircuitMetrics
from transpiler import parse_openqasm3, transpile_workload, generate_preparation_receipt

def prepare_quantum_workload(
    req: PrepareRequest,
    backend_target: Any
) -> Dict[str, Any]:
    workload = req.workload
    if workload.type not in ("openqasm3", "sampler-circuit", "estimator-circuit"):
        raise ValueError(f"Unsupported workload type '{workload.type}'.")

    circuit = parse_openqasm3(workload.circuit)

    observables = workload.observables if req.primitive == "estimator" else None
    isa_circuit, metrics, isa_observables = transpile_workload(
        circuit=circuit,
        backend_target=backend_target,
        optimization_level=req.optimizationLevel,
        observables=observables
    )

    abstract_qasm = qasm3_dumps(circuit)
    isa_qasm = qasm3_dumps(isa_circuit)

    receipt = generate_preparation_receipt(
        backend_name=req.backend,
        primitive=req.primitive,
        optimization_level=req.optimizationLevel,
        abstract_qasm=abstract_qasm,
        isa_qasm=isa_qasm,
        metrics=metrics
    )

    pub_payload: Dict[str, Any] = {
        "circuit": isa_qasm,
        "shots": req.shots,
    }
    if req.primitive == "estimator" and isa_observables:
        pub_payload["observables"] = [obs.to_list() for obs in isa_observables]

    return {
        "state": "PREPARED",
        "backend": req.backend,
        "primitive": req.primitive,
        "optimizationLevel": req.optimizationLevel,
        "shots": req.shots,
        "abstractQasm": abstract_qasm,
        "isaQasm": isa_qasm,
        "metrics": metrics,
        "hardwareCompatible": True,
        "pubPayload": pub_payload,
        "receipt": receipt,
    }
