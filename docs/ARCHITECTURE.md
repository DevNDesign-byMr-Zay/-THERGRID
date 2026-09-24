# THERGRID Architecture

## 1. System boundary

THERGRID is an energy-systems digital-twin platform. It should separate **observation**, **simulation**, **decision support**, **visualization**, and any future **actuation** into distinct boundaries.

The initial platform must remain useful with synthetic data and deterministic local computation. Cloud AI, quantum services, hardware telemetry, and advanced spatial rendering are integrations — not prerequisites for the core to run.

## 2. Logical layers

### Data and telemetry layer

Responsibilities:
- asset registry and topology
- telemetry ingestion and timestamp normalization
- units and schema validation
- quality flags and missing-data handling
- synthetic fixtures for development

Output: a normalized `GridSnapshot` contract.

### Digital twin layer

Responsibilities:
- derive current state from `GridSnapshot`
- represent generation, storage, load, transmission/distribution edges, and constraints
- replay historical/synthetic scenarios
- calculate derived values without mutating raw telemetry

Output: a deterministic `TwinState`.

### Forecast and optimization layer

Responsibilities:
- renewable generation forecasts
- load forecasts
- battery/storage scheduling
- demand-shift and curtailment proposals
- constraint-aware optimization
- anomaly and risk scoring

Output: one or more ranked `OperatingProposal` objects.

Every proposal must include assumptions, constraints, objective values, algorithm/model identity, and confidence or uncertainty where applicable.

### Simulation gateway

Responsibilities:
- run candidate proposals against classical simulation backends
- expose a provider-neutral adapter for quantum or quantum-inspired experiments
- record backend, solver, version, seed, inputs, outputs, duration, and objective values
- always retain a deterministic classical comparison path

Output: `SimulationResult` plus comparison metrics.

### Audit and safety plane

Responsibilities:
- stable decision receipts
- provenance and version tracking
- policy evaluation
- human-approval gates
- replay references
- fail-closed handling when required evidence is missing

No future actuator should accept an `OperatingProposal` directly. It should accept only an approved, policy-valid command derived from an auditable proposal and simulation result.

### Spatial / holographic presentation layer

Responsibilities:
- convert `TwinState`, alerts, proposals, and simulations into a renderer-neutral scene contract
- negotiate presentation against declared device capabilities
- support 2D, 3D, AR/VR, and future holographic clients without changing core twin logic
- surface provenance and confidence alongside visual state
- carry validated asset/node power-flow evidence, forecast deltas, and simulation outcomes as renderer-neutral data rather than UI-invented state
- stop at a renderer-ready plan; physical actuation remains outside this layer

Output: `SpatialScene` plus an optional `HolographicPresentationPlan`. The scene keeps compatibility layer flags, but its operational evidence is sourced from validated TwinState/Forecast/Simulation contracts and is carried through the checksummed renderer packet.

The presentation path is intentionally downstream of authoritative state:

`TwinState -> proposal -> simulation -> decision receipt -> SpatialScene -> device capability routing -> renderer-ready plan`

A missing presentation device must not invalidate the underlying simulation or decision evidence.

## 3. Model-family integration

ROARY, VÆLON, AUREN, and SOLVÆR should connect through `packages/model-routing/` contracts rather than importing each other's internal implementation.

The routing layer should define:
- capability name
- input schema
- output schema
- safety classification
- model/version identity
- timeout and fallback behavior
- audit metadata

Do not hardwire a model name into grid truth. The digital twin and safety plane must remain authoritative even if a model is unavailable or replaced.

## 4. Initial shared contracts

Phase 1 should define these schemas first:

- `Asset`
- `GridTopology`
- `TelemetryPoint`
- `GridSnapshot`
- `TwinState`
- `Forecast`
- `OperatingProposal`
- `SimulationRequest`
- `SimulationResult`
- `DecisionReceipt`
- `SpatialScene`
- `HolographicDeviceDescriptor`
- `HolographicPresentationPlan`

Use versioned schemas and reject unknown required fields or malformed units at system boundaries.

## 5. First vertical slice

Build one synthetic microgrid with:
- solar generation
- wind generation
- battery storage
- fixed and flexible loads
- utility/grid interconnect
- simple operating constraints

Then implement:

1. fixture loading and validation
2. deterministic state calculation
3. one baseline forecast
4. one classical optimization proposal
5. simulation of that proposal
6. decision receipt generation
7. spatial scene serialization
8. presentation capability negotiation
9. integration tests covering the full path

## 6. Security and safety constraints

- No credentials in source or fixtures.
- No live infrastructure commands in Phase 1.
- No silent model fallback: fallback identity must be recorded in the receipt.
- No quantum-performance claims without a reproducible baseline and metric.
- Reject stale telemetry when freshness is required by the scenario.
- Keep raw telemetry immutable; derived state belongs in separate records.
- Every autonomous boundary must be observable and testable.
- Device descriptors are capability declarations only; they never authorize actuation.
- Renderer selection must fail closed to `no-compatible-device` rather than inventing a target.

## 7. Definition of done for architecture foundation

The architecture foundation is ready when a fresh clone can install, run tests, execute the synthetic microgrid scenario, and generate deterministic `TwinState`, `OperatingProposal`, `SimulationResult`, `DecisionReceipt`, `SpatialScene`, and renderer-ready presentation artifacts without external credentials or physical side effects.
