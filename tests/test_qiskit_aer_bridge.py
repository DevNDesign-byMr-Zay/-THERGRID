"""Contract and real-backend tests for the optional local Qiskit Aer sidecar."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest

BRIDGE = Path(__file__).resolve().parents[1] / "apps" / "aethergrid-console" / "qiskit-aer-bridge.py"
AER_AVAILABLE = importlib.util.find_spec("qiskit_aer") is not None


def invoke(problem=None, check=False):
    command = [sys.executable, str(BRIDGE)]
    if check:
        command.append("--check")
    result = subprocess.run(
        command,
        input=json.dumps(problem) if problem is not None else "",
        text=True,
        capture_output=True,
        timeout=20,
        check=False,
    )
    return result, json.loads(result.stdout)


class QiskitBridgeTests(unittest.TestCase):
    def test_check_reports_actual_optional_backend_and_no_hardware(self):
        result, payload = invoke(check=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(payload["provider"], "qiskit-aer")
        self.assertEqual(payload["executionType"], "quantum-circuit-simulation")
        self.assertIs(payload["hardwareSubmitted"], False)
        self.assertIs(payload["hardwareExecuted"], False)
        self.assertEqual(payload["available"], AER_AVAILABLE)

    def test_malformed_and_unsafe_problems_are_rejected_without_execution(self):
        invalid = [
            {"experiment": "unknown"},
            {"experiment": "bell", "shots": 0},
            {"experiment": "bell", "shots": 4097},
            {"experiment": "bell", "seed": -1},
            {"experiment": "bell", "seed": 4.1},
            {"experiment": "qubo-qaoa", "linear": []},
            {"experiment": "qubo-qaoa", "linear": [1] * 9},
            {"experiment": "qubo-qaoa", "linear": [1], "quadratic": [[2]]},
            {"experiment": "qubo-qaoa", "linear": [1, 1], "quadratic": [[0, 0], [5, 0]]},
            {"experiment": "qubo-qaoa", "linear": [1], "gamma": "0.3"},
            {"experiment": "qubo-qaoa", "linear": [1], "beta": -0.1},
        ]
        for value in invalid:
            with self.subTest(value=value):
                result, payload = invoke(value)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIs(payload["ok"], False)
                self.assertEqual(payload["error"], "invalid-circuit-input")
                self.assertFalse(payload["hardwareExecuted"])

    @unittest.skipUnless(AER_AVAILABLE, "optional qiskit-aer not installed")
    def test_actual_bell_circuit_counts_are_seeded_and_entangled(self):
        request = {"experiment": "bell", "shots": 256, "seed": 42}
        first, payload = invoke(request)
        second, repeat = invoke(request)
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["result"]["counts"], repeat["result"]["counts"])
        self.assertEqual(sum(payload["result"]["counts"].values()), 256)
        self.assertEqual(set(payload["result"]["counts"]), {"00", "11"})
        self.assertEqual(payload["result"]["backend"], "aer-simulator-cpu")
        self.assertEqual(payload["result"]["executionType"], "quantum-circuit-simulation")
        self.assertFalse(payload["result"]["hardwareExecuted"])
        self.assertEqual(len(payload["result"]["receipt"]), 64)

    @unittest.skipUnless(AER_AVAILABLE, "optional qiskit-aer not installed")
    def test_qaoa_uses_quantum_measurements_and_real_qubo_objective(self):
        request = {
            "experiment": "qubo-qaoa",
            "linear": [-2, -1],
            "quadratic": [[0, 3], [0, 0]],
            "gamma": 0.45,
            "beta": 0.7,
            "shots": 512,
            "seed": 7,
        }
        result, payload = invoke(request)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(payload["ok"])
        data = payload["result"]
        self.assertEqual(data["qubits"], 2)
        self.assertEqual(sum(data["counts"].values()), 512)
        self.assertEqual(set(data["counts"]).issubset({"00", "01", "10", "11"}), True)
        weighted = sum(
            count * (-2 * int(bitstring[1]) - int(bitstring[0]) + 3 * int(bitstring[1]) * int(bitstring[0]))
            for bitstring, count in data["counts"].items()
        ) / 512
        self.assertAlmostEqual(data["expectationObjective"], weighted)
        self.assertEqual(data["bestObservedObjective"], min(
            -2 * int(bits[1]) - int(bits[0]) + 3 * int(bits[1]) * int(bits[0])
            for bits in data["counts"]
        ))
        self.assertFalse(data["optimalityProven"])
        self.assertFalse(data["hardwareExecuted"])


if __name__ == "__main__":
    unittest.main()
