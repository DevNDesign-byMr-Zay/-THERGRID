# ÆTHERGRID Operator Console

ÆTHERGRID is the operator-intelligence identity of the maintained THERGRID application service. The repository/package names remain `THERGRID` / `thergrid` for continuity, while **ÆTHERGRID** names the user-facing system experience.

## Purpose

ÆTHERGRID helps an operator understand and explore a renewable-energy system through one evidence-bound interface that combines:

- a validated **energy digital twin**;
- **AI collaboration** for scenario explanation, optimization exploration, operator meaning, and bounded candidate analysis;
- **quantum and quantum-inspired optimization experiments** that always retain a deterministic classical baseline;
- **holographic / spatial presentation** for renderer-neutral 2D, 3D, AR/VR, volumetric, projector, and web-dashboard targets;
- an **audit and safety plane** that binds recommendations to provenance, fingerprints, simulation evidence, and explicit authority limits.

The operator console is not an infrastructure-control panel. It is an advisory review surface.

## Product statement

> **See the grid. Explore the future. Verify every recommendation.**

The intended user flow is:

```text
validated telemetry
      ↓
energy digital twin
      ↓
AI + classical / quantum-inspired scenario exploration
      ↓
simulation and evidence
      ↓
holographic spatial review
      ↓
human operator interpretation
      ↓
auditable recommendation
```

No step grants physical actuation authority.

## Console information architecture

The first maintained UI lives at `apps/operator-console/` and exposes five operator surfaces:

### GRID

The default digital-twin view. It presents the system as an energy topology with renewable generation, storage, load, grid connection, and renderer-neutral flow relationships.

The field is now fed from the validated synthetic operator-state chain. Asset nodes, power flows, generation/load/balance totals, and scene identity come from the maintained digital-twin and spatial-scene contracts. It remains explicitly labeled **validated synthetic** because live telemetry is not connected.

### HOLOGRAPHIC

The spatial review layer. It visualizes evidence as stacked scene layers such as:

- operator attention;
- simulation outcome;
- power flows;
- digital-twin state.

Presentation targets are read from the existing holographic device registry. Holographic output remains non-authoritative and cannot actuate hardware.

### QUANTUM

The experiment surface for VÆLON's quantum boundary.

Every experiment is shown beside the deterministic classical control group. The currently implemented local quantum-inspired backend is exposed through the same capability contract used by the UI. Remote simulators or real quantum hardware are future provider adapters, not implied current capability.

### AI

The bounded model-collaboration surface:

- **VÆLON** — optimization and scenario exploration;
- **AUREN** — semantic and operator meaning;
- **SOLVÆR** — bounded candidate computation and simulation evidence.

These are explicit roles, not permission to bypass THERGRID safety or provenance contracts.


Each model uses its dedicated visual identity in the console. The maintained UI assets preserve the supplied SOLVÆR circular seal and AUREN / VÆLON triangular marks without recoloring them; compact model rows and full AI collaboration cards use the same model-specific artwork.

### EVIDENCE

The audit plane for decision receipts, provenance fingerprints, operator attention, simulation evidence, and holographic render-packet integrity.

The UI keeps the authority boundary visible:

- advisory-only recommendations;
- no physical actuation;
- no infrastructure dispatch;
- no infrastructure deployment;
- no silent candidate promotion.

## Runtime

Run the console from a locked fresh clone:

```bash
npm ci --ignore-scripts
npm run operator-console
```

The default local URL is:

```text
http://127.0.0.1:8090
```

Override the port with `AETHERGRID_CONSOLE_PORT`.

The console serves two read-only endpoints:

```text
GET /api/capabilities
GET /api/operator-state
```

`/api/capabilities` describes what the platform can do. `/api/operator-state` is a deterministic validated operator run composed through the maintained digital-twin, SOLVÆR simulation projection, operator-attention, provenance, dashboard-view, spatial-scene, and holographic render-packet contracts.

The endpoints are built from maintained application modules rather than disconnected UI fixtures:

- `src/model-routing.mjs`
- `src/holographic-device-registry.mjs`
- `packages/optimization-engine/quantum-inspired.js`
- `src/operator-console-capabilities.mjs`
- `src/operator-console-state.mjs`
- `src/operator-dashboard-view.mjs`
- `src/operator-evidence-package.mjs`
- `src/spatial-scene.mjs`
- `src/holographic-renderer-contract.mjs`

All non-GET requests are rejected by the console server.

## Current UI boundary

The console is now evidence-driven for its GRID, HOLOGRAPHIC, and EVIDENCE surfaces. The maintained synthetic snapshot runs through:

```text
validated snapshot
  → digital twin
  → forecast / proposal / simulation
  → SOLVÆR simulation projection
  → operator evidence summary
  → operator attention
  → provenance read model
  → evidence package
  → dashboard view
  → attention-enriched spatial scene
  → web-dashboard render packet
```

The UI intentionally does not invent:

- live grid telemetry;
- remote quantum-provider results;
- hardware state;
- operator approvals;
- autonomous AI decisions.

The next product integration is a provider-neutral telemetry ingestion adapter that can replace the validated synthetic snapshot without changing the downstream evidence and authority contracts.

## Brand direction

ÆTHERGRID should feel like advanced scientific and operator software rather than a game interface:

- deep gunmetal / near-black base;
- restrained cyan, violet, and spectral-magenta holographic accents;
- layered depth and field visualization;
- compact operator labels;
- evidence and safety status always visible;
- motion used to communicate energy flow and dimensionality, not decoration.

Quantum, holographic, and AI visuals should communicate the underlying contracts clearly and should never imply unsupported authority.
