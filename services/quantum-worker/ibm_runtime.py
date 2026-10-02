from typing import Any, Optional
import os

def get_ibm_backend_target(backend_name: str, api_key: Optional[str] = None, service_crn: Optional[str] = None) -> Any:
    key = api_key or os.getenv("AETHERGRID_IBM_QUANTUM_API_KEY", "")
    crn = service_crn or os.getenv("AETHERGRID_IBM_QUANTUM_SERVICE_CRN", "")

    if key and crn:
        try:
            from qiskit_ibm_runtime import QiskitRuntimeService
            service = QiskitRuntimeService(channel="ibm_quantum", token=key, instance=crn)
            backend = service.backend(backend_name)
            return backend.target
        except Exception:
            pass

    # Fallback to FakeBackend for offline / testing mode
    try:
        from qiskit.providers.fake_provider import GenericBackendV2
        return GenericBackendV2(num_qubits=127).target
    except Exception as e:
        raise RuntimeError(f"Unable to load target for backend '{backend_name}': {str(e)}")
