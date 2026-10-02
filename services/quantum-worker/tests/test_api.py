import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

BELL_STATE_QASM = """
OPENQASM 3.0;
include "stdgates.inc";
qubit[2] q;
bit[2] c;
h q[0];
cx q[0], q[1];
c[0] = measure q[0];
c[1] = measure q[1];
"""

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_prepare_sampler():
    payload = {
        "provider": "ibm-quantum",
        "backend": "ibm_sherbrooke",
        "primitive": "sampler",
        "workload": {
            "type": "openqasm3",
            "circuit": BELL_STATE_QASM
        },
        "optimizationLevel": 2,
        "shots": 4096
    }
    response = client.post("/v1/prepare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["state"] == "PREPARED"
    assert data["hardwareCompatible"] is True
    assert "sha256:" in data["receipt"]
    assert data["metrics"]["logicalQubits"] == 2

def test_dry_run():
    payload = {
        "provider": "ibm-quantum",
        "backend": "ibm_sherbrooke",
        "primitive": "sampler",
        "workload": {
            "type": "openqasm3",
            "circuit": BELL_STATE_QASM
        },
        "optimizationLevel": 2,
        "shots": 4096
    }
    response = client.post("/v1/dry-run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["state"] == "DRY_RUN_VALIDATED"
    assert data["dryRunValidated"] is True
    assert data["preparation"]["state"] == "PREPARED"

def test_invalid_qasm():
    payload = {
        "provider": "ibm-quantum",
        "backend": "ibm_sherbrooke",
        "primitive": "sampler",
        "workload": {
            "type": "openqasm3",
            "circuit": "INVALID OPENQASM CODE"
        }
    }
    response = client.post("/v1/prepare", json=payload)
    assert response.status_code == 400
