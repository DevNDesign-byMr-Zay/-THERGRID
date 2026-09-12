# THERGRID

THERGRID is a self-auditing, AI-operated renewable-energy digital twin with a spatial/holographic command interface and a quantum-simulation layer.

## Project direction

The goal is to build a defensible systems platform that can model distributed energy assets, ingest live or simulated telemetry, estimate grid state, test operating strategies, visualize the system spatially, and produce an auditable record of every recommendation or autonomous action.

THERGRID should grow as a modular platform rather than one monolithic AI. The current Mr. Zay model family — ROARY with the next-generation VÆLON, AUREN, and SOLVÆR concepts — should connect through explicit contracts so each intelligence layer can evolve without breaking the digital twin, spatial interface, audit plane, or simulation stack.

## Core capability pillars

1. **Energy digital twin** — asset topology, telemetry normalization, state estimation, forecasting, scenario replay, and renewable-generation/storage/load models.
2. **AI orchestration** — policy-aware planning, optimization, anomaly detection, recommendation ranking, tool routing, and explainable decision traces.
3. **Spatial / holographic command surface** — a 2D/3D scene model that can render grid assets, flows, alerts, simulations, and operator controls without coupling the UI to one rendering vendor.
4. **Quantum simulation gateway** — provider-neutral interfaces for optimization and simulation experiments, with deterministic classical baselines and fallbacks so quantum claims remain measurable.
5. **Audit and safety plane** — immutable decision receipts, approval boundaries, replayable simulations, provenance, model/version tracking, and fail-closed controls for anything that could affect physical infrastructure.

## Proposed repository shape

```text
apps/
  operator-console/          # web / spatial command experience
services/
  twin-engine/               # topology, state, telemetry and scenario model
  optimization-engine/       # renewable generation, storage and load planning
  simulation-gateway/        # classical + quantum backend adapters
  audit-ledger/              # decision receipts, provenance and replay evidence
packages/
  contracts/                 # shared schemas and API/event contracts
  telemetry/                 # normalization, validation and sample fixtures
  spatial-scene/             # renderer-neutral scene graph / view models
  model-routing/             # ROARY / VÆLON / AUREN / SOLVÆR routing contracts
  safety/                    # policies, approvals and actuation guards
docs/
  ARCHITECTURE.md
  ROADMAP.md
tests/
  integration/
  fixtures/
```

The folders above are the target architecture. Add them only as real code or documentation lands; do not create empty scaffolding just to make the tree look complete.

## Phase 1 acceptance target

The first working vertical slice should take a small synthetic microgrid fixture through the entire chain:

`telemetry -> validated twin state -> forecast/scenario -> optimization proposal -> audit receipt -> spatial scene payload`

Phase 1 is complete when that path is deterministic, tested, reproducible from a fresh clone, and produces no unaudited side effects.

## Engineering rules

- Simulation before actuation. No direct real-world control surface until explicit safety, authorization, rollback, and human-approval contracts exist.
- Every recommendation must carry provenance: inputs, model/algorithm version, assumptions, confidence/constraints, and a stable receipt ID.
- Quantum work must always ship with a classical baseline and measurable comparison criteria.
- Keep provider-specific APIs behind adapters.
- Prefer small PRs with tests and clear acceptance criteria over broad speculative scaffolding.
- Never commit credentials, live customer/grid data, private keys, or environment secrets.
- Treat spatial/holographic UI as a consumer of stable scene contracts, not the source of grid truth.

## Current status

**Foundation / architecture phase.** The next priority is to establish shared contracts, a synthetic microgrid fixture, deterministic twin-state computation, and the audit-receipt path before expanding into advanced optimization, quantum adapters, or production visualization.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md) for the working technical plan.
