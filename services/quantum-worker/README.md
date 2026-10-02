# ÆTHERGRID Python Quantum Worker Service

Hardware-aware Qiskit transpilation and preflight preparation worker for IBM Quantum V2 primitives (`SamplerV2` & `EstimatorV2`).

## Scope
- Abstract circuit parsing & OpenQASM 3 validation
- Hardware layout mapping & ISA circuit transpilation via `generate_preset_pass_manager`
- Estimator observable layout alignment (`observable.apply_layout(isa_circuit.layout)`)
- Execution PUB (Primitive Unified Blocs) formatting for `SamplerV2` and `EstimatorV2`
- Preflight validation with IBM `dry_run=True`
- Strict execution authority boundary (`APPROVAL_REQUIRED` before QPU submission)

## API Endpoints
- `POST /v1/prepare` — Transpiles abstract circuit to backend ISA circuit and returns metrics & evidence receipt
- `POST /v1/dry-run` — Preflight validation against IBM Quantum API without QPU hardware execution
- `GET /health` — Service readiness & status
