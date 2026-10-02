from typing import Dict, Any, Optional, List, Union
from pydantic import BaseModel, Field

class WorkloadSpec(BaseModel):
    type: str = Field(..., description="openqasm3, sampler-circuit, or estimator-circuit")
    circuit: str = Field(..., description="OpenQASM 3 string or serialized circuit JSON")
    observables: Optional[List[str]] = Field(None, description="Pauli observables for Estimator workloads")

class PrepareRequest(BaseModel):
    provider: str = Field("ibm-quantum", description="Provider ID")
    backend: str = Field(..., description="IBM Quantum Backend name")
    primitive: str = Field("sampler", description="sampler or estimator")
    workload: WorkloadSpec
    optimizationLevel: int = Field(2, ge=0, le=3)
    shots: int = Field(4096, ge=1, le=100000)
    apiKey: Optional[str] = None
    serviceCrn: Optional[str] = None

class CircuitMetrics(BaseModel):
    logicalQubits: int
    physicalQubits: int
    depthBefore: int
    depthAfter: int
    twoQubitDepthBefore: int
    twoQubitDepthAfter: int
    gateCountBefore: int
    gateCountAfter: int

class PrepareResponse(BaseModel):
    state: str = Field("PREPARED")
    backend: str
    primitive: str
    optimizationLevel: int
    shots: int
    abstractQasm: str
    isaQasm: str
    metrics: CircuitMetrics
    hardwareCompatible: bool
    pubPayload: Dict[str, Any]
    receipt: str

class DryRunRequest(PrepareRequest):
    pass

class DryRunResponse(BaseModel):
    state: str = Field("DRY_RUN_VALIDATED")
    backend: str
    primitive: str
    hardwareCompatible: bool
    dryRunSubmitted: bool
    dryRunValidated: bool
    preparation: PrepareResponse
    ibmValidationStatus: str
    receipt: str
