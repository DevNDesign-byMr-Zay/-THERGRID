# ÆTHERGRID Functional Workspaces Plan

ÆTHERGRID is being developed as a real operator application, not a visual mockup. The product must preserve the advisory-only safety boundary while making every operator-facing surface usable, stateful, testable, packageable, and replaceable.

## Product purpose

ÆTHERGRID combines four coordinated capabilities:

1. **GRID** — live digital-twin observation, time-indexed spatial data, asset inspection, telemetry, regions, scenarios and evidence-linked operating state.
2. **HOLOGRAPHIC** — renderer-driven 3D/4D spatial analysis with wireframe topology, layers, camera controls, temporal state and future-state comparison.
3. **QUANTUM** — bounded optimization lab with explicit objectives, constraints, classical comparison, run history and evidence receipts.
4. **AI** — replaceable specialized agents that can work independently or as a team without becoming authoritative grid truth.
5. **EVIDENCE** — provenance, receipts, exports, audit events and reproducibility.
6. **SETTINGS** — persistent non-secret operator preferences and visible provider/runtime readiness.

## Non-negotiable architecture rules

- No screenshot-backed runtime UI.
- Runtime controls are semantic HTML, SVG, Canvas or WebGL elements.
- x/y/z + time is the maintained 4D spatial model.
- Physical actuation and infrastructure dispatch remain disabled.
- Model output is advisory and cannot silently mutate authoritative twin state.
- Model providers are adapters. Replacing a model must require configuration changes, not UI rewrites.
- Secrets stay server-side and are never serialized to the browser or ZIP manifests.
- Every packaged ZIP must contain all maintained source, app/json manifests, tests/docs needed for review, and a direct-open standalone HTML fallback.
- Backend-connected mode must run from the same ZIP with Node 22.

## Batch plan

### Batch 1 — View router + real settings
Status: COMPLETE

Deliver:
- real workspace router: Grid, Holographic, Quantum, AI, Evidence, Scenarios, Settings;
- top tabs and left navigation switch workspace content instead of only scrolling;
- persistent browser settings using localStorage;
- animation intensity, telemetry preference, default workspace, auto-rotate, spatial labels, reduced motion and density controls;
- safe backend runtime/config endpoint;
- tests that prove views/settings are real controls.

### Batch 2 — Replaceable AI provider layer
Status: COMPLETE

Deliver:
- provider-neutral agent runtime;
- OpenAI-compatible HTTP adapter;
- Ollama/local adapter;
- deterministic no-credential fallback;
- per-agent model/provider assignment via one config module;
- safe readiness endpoint that exposes provider/model identity but never API keys;
- timeout, error, fallback and receipt metadata.

### Batch 3 — Individual agents + team orchestration
Status: COMPLETE

Deliver:
- VÆLON: optimization/scenario exploration;
- AUREN: semantic/spatial analysis;
- SOLVÆR: simulation/evidence generation;
- individual prompt endpoints;
- team endpoint that invokes all three agents, records contributions and performs a bounded synthesis step;
- UI mode switch between agent and team chat;
- visible model/provider badges.

### Batch 4 — Holographic workspace
Status: IN PROGRESS

Deliver:
- full-screen spatial workspace;
- WebGL camera presets;
- selectable topology, assets, routes, risk, flow and future-state layers;
- temporal compare/split state;
- node inspector;
- saved camera views;
- exportable spatial scene data.

### Batch 5 — Quantum workspace
Status: IN PROGRESS

Deliver:
- objective selector;
- weighted cost/emissions/reliability/renewable controls;
- constraint editor;
- classical vs experimental comparison;
- run history;
- immutable receipt per run;
- visualization of objective landscape and selected candidate.

### Batch 6 — Evidence, scenarios and operator workflow
Status: IN PROGRESS

Deliver:
- scenario builder;
- scenario duplication/reset;
- evidence browser;
- audit activity timeline;
- filter/search;
- JSON export package;
- operator report data package;
- reproducibility metadata.

### Batch 7 — Packaging, launchers and regression gates
Status: IN PROGRESS

Deliver:
- Windows PowerShell launcher;
- optional batch launcher;
- generated self-contained standalone HTML;
- complete app ZIP;
- non-empty-file validation;
- provider configuration examples without secrets;
- CI/browser contract tests;
- no-screenshot regression gate;
- SHA-256 inventory.

## Replaceable model contract

Each agent resolves through configuration with this shape:

```json
{
  "id": "VAELON",
  "provider": "openai-compatible",
  "model": "configured-by-env-or-local-config",
  "role": "Optimization & Scenario Exploration",
  "timeoutMs": 45000
}
```

Provider adapters implement a small contract:

- `complete({ agent, messages, context, signal })`
- return text, provider/model identity, latency and usage metadata when supplied by the provider;
- throw typed errors for unavailable credentials, timeouts and malformed responses.

The UI never receives provider secrets.

## Definition of fully functional

A fresh ZIP is considered functional when:

- `node server.mjs` launches the complete application;
- every primary navigation item switches to a distinct usable workspace;
- all visible settings mutate real application behavior and persist;
- Grid/Holographic/Quantum/AI/Evidence/Scenario controls produce real state changes;
- the three agents can run individually;
- team mode produces a multi-agent result and records each contribution;
- model/provider assignments can be replaced from configuration;
- absence of model credentials degrades visibly to deterministic local fallback instead of breaking the app;
- tests, lint, typecheck, coverage, release readiness, package assembly and CodeQL pass;
- the runtime does not depend on the old dashboard screenshot.


## Current branch progress

The current functional-workspaces branch now includes:

- exclusive workspace routing for Grid, Holographic, Quantum, AI, Scenarios, Evidence and Settings;
- persistent non-secret operator settings;
- Windows PowerShell/CMD launchers and app-local provider configuration example;
- native WebGL Grid + independent Holographic renderer;
- Holographic projection, temporal mode, intensity, time and layer controls;
- bounded optimization inputs that affect deterministic classical/experimental comparison results;
- replaceable `local`, `openai-compatible` and `ollama` provider adapters;
- per-agent provider/model overrides;
- real individual-agent endpoints;
- three-agent parallel team orchestration with configurable synthesis provider;
- provider-failure fallback with runtime metadata and SHA-256 receipts;
- model/provider readiness UI that never exposes provider secrets;
- evidence records generated by optimization runs.

Remaining before this roadmap is marked complete:

- richer node picking directly inside the WebGL canvas;
- scenario editing/duplication instead of fixed scenario templates only;
- expanded evidence drill-down with full receipts and agent contribution records;
- final browser regression pass and distributable ZIP verification.
