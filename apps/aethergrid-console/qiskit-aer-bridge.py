#!/usr/bin/env python3
"""Bounded optional Qiskit Aer CPU simulation bridge.

One JSON request on stdin; one JSON response on stdout. No network, secrets,
QPU credentials, arbitrary QASM ingestion, or persistent service process.
"""
import hashlib
import json
import math
import sys

MAX_REQUEST_BYTES = 16_384
MAX_QUBITS = 8
MAX_SHOTS = 4096
MAX_ABS_COEFFICIENT = 10_000


def fingerprint(value):
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def error_response(message, code="invalid-circuit-input"):
    return {
        "ok": False, "error": code, "message": message,
        "provider": "qiskit-aer", "executionType": "quantum-circuit-simulation",
        "hardwareSubmitted": False, "hardwareExecuted": False,
    }


def require_number(value, name, minimum, maximum, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a number")
    if not math.isfinite(value) or value < minimum or value > maximum:
        raise ValueError(f"{name} must be finite and between {minimum} and {maximum}")
    if integer and int(value) != value:
        raise ValueError(f"{name} must be an integer")
    return int(value) if integer else float(value)


def normalized_input(raw):
    if not isinstance(raw, dict):
        raise ValueError("request must be a JSON object")
    mode = raw.get("experiment")
    if mode not in ("bell", "qubo-qaoa"):
        raise ValueError("experiment must be bell or qubo-qaoa")
    shots = require_number(raw.get("shots", 1024), "shots", 64, MAX_SHOTS, integer=True)
    seed = require_number(raw.get("seed", 42), "seed", 0, 4294967295, integer=True)
    if mode == "bell":
        if set(raw) - {"experiment", "shots", "seed"}:
            raise ValueError("bell accepts only experiment, shots and seed")
        return {"experiment": mode, "shots": shots, "seed": seed}
    allowed = {"experiment", "linear", "quadratic", "gamma", "beta", "shots", "seed"}
    if set(raw) - allowed:
        raise ValueError("unrecognized QAOA field")
    linear = raw.get("linear")
    if not isinstance(linear, list) or not 1 <= len(linear) <= MAX_QUBITS:
        raise ValueError("linear requires between 1 and 8 variables")
    linear = [
        require_number(entry, f"linear[{index}]", -MAX_ABS_COEFFICIENT, MAX_ABS_COEFFICIENT)
        for index, entry in enumerate(linear)
    ]
    dimension = len(linear)
    quadratic = raw.get("quadratic")
    if quadratic is None:
        quadratic = [[0] * dimension for _ in range(dimension)]
    if not isinstance(quadratic, list) or len(quadratic) != dimension:
        raise ValueError("quadratic must be an NxN matrix")
    normalized_matrix = []
    for i, row in enumerate(quadratic):
        if not isinstance(row, list) or len(row) != dimension:
            raise ValueError("quadratic must be an NxN matrix")
        next_row = []
        for j, item in enumerate(row):
            number = require_number(item, f"quadratic[{i}][{j}]", -MAX_ABS_COEFFICIENT, MAX_ABS_COEFFICIENT)
            if j <= i and number != 0:
                raise ValueError("quadratic diagonal and lower triangle must be zero")
            next_row.append(number)
        normalized_matrix.append(next_row)
    return {
        "experiment": mode, "linear": linear, "quadratic": normalized_matrix,
        "gamma": require_number(raw.get("gamma", 0.45), "gamma", 0, math.tau),
        "beta": require_number(raw.get("beta", 0.7), "beta", 0, math.pi),
        "shots": shots, "seed": seed,
    }


def aer_imports():
    from qiskit import QuantumCircuit, transpile
    from qiskit_aer import AerSimulator
    return QuantumCircuit, transpile, AerSimulator


def status():
    try:
        aer_imports()
    except (ImportError, OSError) as exc:
        return {
            "available": False, "reason": "qiskit-aer-not-installed",
            "detail": exc.__class__.__name__,
            "provider": "qiskit-aer",
            "executionType": "quantum-circuit-simulation",
            "hardwareSubmitted": False, "hardwareExecuted": False,
        }
    return {
        "available": True, "reason": None, "provider": "qiskit-aer",
        "backend": "aer-simulator-cpu", "executionType": "quantum-circuit-simulation",
        "hardwareSubmitted": False, "hardwareExecuted": False,
    }


def energy(bitstring, input_data):
    # Qiskit reports classical bit n-1 first; variable x_i is bitstring[-1-i].
    bits = [int(bitstring[-1 - index]) for index in range(len(input_data["linear"]))]
    value = sum(coefficient * bit for coefficient, bit in zip(input_data["linear"], bits))
    for i in range(len(bits)):
        for j in range(i + 1, len(bits)):
            value += input_data["quadratic"][i][j] * bits[i] * bits[j]
    return value


def execute(request):
    QuantumCircuit, transpile, AerSimulator = aer_imports()
    is_bell = request["experiment"] == "bell"
    qubits = 2 if is_bell else len(request["linear"])
    circuit = QuantumCircuit(qubits, qubits)
    if is_bell:
        circuit.h(0)
        circuit.cx(0, 1)
    else:
        for index in range(qubits):
            circuit.h(index)
        gamma = request["gamma"]
        beta = request["beta"]
        for i, coefficient in enumerate(request["linear"]):
            if coefficient:
                circuit.rz(-gamma * coefficient, i)
        for i in range(qubits):
            for j in range(i + 1, qubits):
                coupling = request["quadratic"][i][j]
                if coupling:
                    circuit.rz(-gamma * coupling / 2, i)
                    circuit.rz(-gamma * coupling / 2, j)
                    circuit.rzz(gamma * coupling / 2, i, j)
        for index in range(qubits):
            circuit.rx(2 * beta, index)
    circuit.measure(range(qubits), range(qubits))
    simulator = AerSimulator(method="statevector", device="CPU", max_parallel_threads=1)
    compiled = transpile(circuit, simulator, optimization_level=0, seed_transpiler=request["seed"])
    job = simulator.run(compiled, shots=request["shots"], seed_simulator=request["seed"])
    counts = {str(bitstring).replace(" ", ""): int(count) for bitstring, count in job.result().get_counts().items()}
    counts = dict(sorted(counts.items()))
    if sum(counts.values()) != request["shots"]:
        raise RuntimeError("Aer returned an inconsistent shot count")
    result = {
        "provider": "qiskit-aer",
        "backend": "aer-simulator-cpu",
        "executionType": "quantum-circuit-simulation",
        "simulationMethod": "statevector",
        "noiseModel": "ideal-noiseless",
        "hardwareSubmitted": False, "hardwareExecuted": False,
        "optimalityProven": False,
        "experiment": request["experiment"],
        "qubits": qubits,
        "shots": request["shots"],
        "seed": request["seed"],
        "circuitDepth": circuit.depth(),
        "counts": counts,
        "probabilities": {key: value / request["shots"] for key, value in counts.items()},
        "inputReceipt": fingerprint(request),
    }
    if not is_bell:
        energies = {bits: energy(bits, request) for bits in counts}
        result.update({
            "gamma": request["gamma"],
            "beta": request["beta"],
            "bestObservedObjective": min(energies.values()),
            "expectationObjective": sum(energies[bits] * frequency for bits, frequency in counts.items()) / request["shots"],
            "bestObservedBitstrings": sorted(bits for bits, value in energies.items() if value == min(energies.values())),
        })
    result["receipt"] = fingerprint(result)
    return {"ok": True, "result": result}


def main():
    if sys.argv[1:] == ["--check"]:
        print(json.dumps(status(), allow_nan=False))
        return
    if len(sys.argv) > 1:
        print(json.dumps(error_response("unsupported command")))
        return
    try:
        payload = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
        if len(payload) > MAX_REQUEST_BYTES:
            raise ValueError("circuit request exceeds size limit")
        request = normalized_input(json.loads(payload.decode("utf-8")))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        print(json.dumps(error_response(str(exc))))
        return
    if not status()["available"]:
        print(json.dumps(error_response("optional Qiskit Aer is unavailable", "qiskit-aer-not-installed")))
        return
    try:
        print(json.dumps(execute(request), allow_nan=False, separators=(",", ":")))
    except Exception:
        # Do not leak environment information or Python interpreter details.
        print(json.dumps(error_response("local Aer circuit execution failed", "simulator-execution-failed")))


if __name__ == "__main__":
    main()
