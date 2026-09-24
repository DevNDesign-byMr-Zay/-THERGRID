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

The first working vertical slice takes a small synthetic microgrid fixture through the entire chain:

`telemetry -> validated twin state -> forecast/scenario -> optimization proposal -> audit receipt -> spatial scene payload`

Phase 1 is considered reproducible only when that path is deterministic, tested from a fresh clone, and produces no unaudited side effects.

## Reproducible verification

THERGRID targets Node.js 22 and commits its lockfile so a fresh clone can reproduce the maintained quality path.

```bash
npm ci --ignore-scripts
npm audit --audit-level=moderate
npm run syntax
npm test
npm run coverage
npm run demo
```

`npm run demo` executes the deterministic synthetic-microgrid vertical slice and prints a compact evidence summary containing the snapshot, experiment, receipt, scene, render target, provenance result, promotion status, and the advisory SOLVÆR handoff state. The demo fails closed if simulation or provenance validation fails or if the promotion gate becomes authoritative.

Pull requests and pushes to `main` run the same reproducible install, dependency audit, syntax checks, test coverage, and demo path. CodeQL runs separately as the maintained static security-analysis gate.

## Engineering rules

- Simulation before actuation. No direct real-world control surface until explicit safety, authorization, rollback, and human-approval contracts exist.
- Every recommendation must carry provenance: inputs, model/algorithm version, assumptions, confidence/constraints, and a stable receipt ID.
- Quantum work must always ship with a classical baseline and measurable comparison criteria.
- Keep provider-specific APIs behind adapters.
- Prefer small PRs with tests and clear acceptance criteria over broad speculative scaffolding.
- Never commit credentials, live customer/grid data, private keys, or environment secrets.
- Treat spatial/holographic UI as a consumer of stable scene contracts, not the source of grid truth.

## Current status

**Working deterministic vertical slice under hardening.** The repository now contains the synthetic microgrid path, evidence/provenance gates, simulation-bound model handoffs, renderer-neutral spatial output, source-backed topology and operator-attention identity, plus operational scene evidence for asset power state, forecast deltas, and simulation outcomes. Current work is focused on reproducibility, security evidence, adversarial validation, and keeping every model boundary advisory until explicit downstream authorization exists.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md) for the working technical plan.
