# THERGRID Roadmap

## Phase 0 — Foundation

Goal: make the repository understandable and runnable before advanced systems work begins.

Deliverables:
- architecture and engineering rules documented
- language/runtime choice recorded with rationale
- package/workspace layout established only as code lands
- lint, test, formatting, dependency audit, and secret scanning in CI
- `.env.example` contains names only — never real credentials
- contributor workflow and PR expectations documented

Exit criteria: fresh clone installs and runs the baseline checks with one command.

## Phase 1 — Synthetic microgrid vertical slice

Goal: prove the complete THERGRID information path without external services.

Deliverables:
- versioned shared schemas
- synthetic solar/wind/storage/load/interconnect fixture
- telemetry validation + normalization
- deterministic twin-state engine
- baseline forecast
- classical operating optimizer
- scenario simulator
- stable decision receipt
- renderer-neutral spatial scene payload
- full integration test

Exit criteria: one command runs the scenario end-to-end and produces deterministic artifacts.

## Phase 2 — Intelligent orchestration

Goal: introduce ROARY-family intelligence without making model output authoritative grid truth.

Deliverables:
- model-routing contract
- capability registry for ROARY / VÆLON / AUREN / SOLVÆR integrations
- structured tool calls
- model/version/fallback evidence in every receipt
- policy checks before recommendations are accepted
- evaluation fixtures for safe failure, hallucinated values, stale context, and unavailable models

Exit criteria: models can propose and explain decisions, but deterministic validation and safety contracts can reject them.

## Phase 3 — Advanced simulation and quantum gateway

Goal: add measurable advanced optimization experiments.

Deliverables:
- provider-neutral solver adapter
- classical reference solver
- quantum / quantum-inspired adapter interface
- seeded reproducibility
- objective, constraint, runtime, and solution-quality comparison metrics
- experiment receipts and benchmark reports

Exit criteria: every advanced solver result can be compared against the classical baseline with reproducible evidence.

## Phase 4 — Spatial and holographic command experience

Goal: turn system state and simulations into an operator-grade spatial interface.

Deliverables:
- scene graph contract
- grid topology visualization
- real-time flow overlays
- alerts and anomaly layers
- scenario scrub/replay
- proposal comparison
- audit-receipt inspection
- 3D interaction baseline with adapters for AR/VR/holographic surfaces

Exit criteria: the UI can switch rendering technologies without changing twin truth or decision logic.

## Phase 5 — External telemetry and controlled pilots

Goal: connect real data while keeping the system advisory-only.

Deliverables:
- authenticated telemetry adapters
- timestamp/freshness enforcement
- data-quality monitoring
- tenant/environment separation
- observability and incident traces
- advisory pilot reports

Exit criteria: live data can drive the twin and recommendations with no physical actuation.

## Phase 6 — Safety-gated actuation research

Goal: explore physical control only after explicit safety and authorization work exists.

Required before any actuator is enabled:
- human approval policy
- role-based authorization
- hardware allowlist
- command bounds
- rollback/abort behavior
- redundant safety checks
- signed decision/approval receipts
- sandbox and hardware-in-the-loop validation
- documented emergency stop path

No production actuation should be added merely to demonstrate capability.

## Immediate work queue

1. Choose and record the initial runtime/workspace stack.
2. Define `Asset`, `GridTopology`, `TelemetryPoint`, and `GridSnapshot` schemas.
3. Add the synthetic microgrid fixture.
4. Implement telemetry validation.
5. Produce deterministic `TwinState` output.
6. Add tests before moving into model or quantum integrations.
