import os
from pydantic import BaseModel

class Settings(BaseModel):
    max_qubits: int = 127
    max_shots: int = 100000
    max_qasm_bytes: int = 256 * 1024  # 256 KB
    default_optimization_level: int = 2
    ibm_quantum_api_key: str = os.getenv("AETHERGRID_IBM_QUANTUM_API_KEY", "")
    ibm_quantum_service_crn: str = os.getenv("AETHERGRID_IBM_QUANTUM_SERVICE_CRN", "")

settings = Settings()
