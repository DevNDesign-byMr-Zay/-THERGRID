# ÆTHERGRID Universal Command Center — vNext Design

**Status:** Design approved in conversation; implementation plan pending written-spec review  
**Repository baseline:** `main @ c5442a3ad6d4026cc25ec48ac4ca66391e573775`  
**Design branch:** `spec/aethergrid-universal-command-center`  
**Date:** 2026-10-06

## 1. Product definition

ÆTHERGRID becomes one user-facing command center for spatial, temporal, operational, market, infrastructure, scientific, business and machine data.

It is not a collection of unrelated dashboards. It is a universal operational-intelligence grid with one shared session, one globe/city state, one temporal state, one source/provenance model, one agent/tool layer and one governed action layer.

The canonical product definition is:

> ÆTHERGRID is a spatial-temporal operational intelligence system that ingests heterogeneous real-time and historical data, creates a unified entity/event graph, computes domain-aware KPIs, allows autonomous agents to reason across domains, and carries out governed actions through plugins, MCP and control adapters.

The canonical React/Cesium application under `apps/aethergrid-console/web/` is the only normal user-facing application. Earlier native/operator-console experiences are retained only as explicit legacy/reference/developer material and must not be launchable as the primary product by accident.

## 2. Non-negotiable experience principles

1. **One command center.** Cesium, agents, quantum, scenarios, evidence, domain packs, settings, plugins, voice and MCP live in one application.
2. **No dead controls.** A visible control either performs a real action, changes real state, opens a working workspace, or is visibly disabled with a truthful reason.
3. **No activation ceremony.** Safe read-only/live capabilities initialize when the UI opens. Users do not run CLI commands to start ordinary functionality.
4. **Contextual control.** Each feature is controlled inside the panel that represents it. A separate master control dashboard is not the primary UX.
5. **The world remains visible.** The central globe/city viewport is the persistent visual anchor.
6. **Application-level scroll is disabled.** The shell is scrollless; only bounded panels/history/thread regions may scroll internally.
7. **Source truth before spectacle.** Animation may interpolate measured data for smoothness but must never convert inferred/predicted/synthetic state into observed fact.
8. **Every action has provenance.** Source, freshness, fallback, confidence and authority state are visible and exportable.
9. **Agents are tools users can direct, not decorative personalities.**
10. **Physical control is governed.** LLMs never bypass deterministic policy, authorization and control gateways.

## 3. Command-center layout

### 3.1 Persistent viewport

The center of the application is one Cesium world that supports:

- true planetary globe;
- real latitude/longitude positioning;
- Cesium World Terrain;
- Cesium OSM Buildings;
- optional photorealistic 3D tiles where licensed/configured;
- domain overlays;
- live entity selection;
- globe → region → city → district cinematic travel;
- current solar/day-night state;
- temporal playback;
- real source-linked city identity.

The native WebGL renderer remains a graceful fallback, not a visually similar replacement that can be mistaken for Cesium.

### 3.2 Left contextual controls

The left rail handles:

- world/city navigation;
- city/coordinate search;
- view mode;
- active domain packs;
- layers;
- temporal state;
- saved views/worksets;
- operator sessions;
- source bindings when they are geography-specific.

### 3.3 Right intelligence workspace

The right rail contains the currently active operational workspace:

- CONTEXT;
- OPERATIONS;
- ANALYSIS;
- AUREN;
- VÆLON;
- SOLVÆR;
- TEAM;
- SCENARIO;
- QUANTUM;
- EVIDENCE;
- SYSTEM.

These are lenses over one shared session, not separate applications.

### 3.4 Settings

Settings configures the system rather than operating it.

Required settings areas:

- Appearance;
- Graphics & Motion;
- Data & Refresh;
- AI Providers & Models;
- Agents & Plugins;
- Integrations;
- MCP;
- Quantum Providers;
- Voice;
- Permissions & Control;
- Privacy & Evidence;
- Developer/Diagnostics.

MCP belongs under **Settings → Integrations → MCP**, not in the primary product-mode rail.

## 4. Theme and accessibility repair

The light-mode contrast defect is a release-blocking issue.

The current implementation must be converted from ad hoc light-mode overrides into complete semantic theme tokens.

Required semantic token classes include:

- app background;
- primary/secondary surface;
- raised surface;
- glass surface;
- primary text;
- secondary text;
- muted text;
- border;
- strong border;
- input background/text;
- selected state;
- success/warning/error;
- live/fallback/stale/unavailable;
- map labels;
- data-label backgrounds;
- chart/telemetry colors.

Rules:

- dark surfaces always receive light-enough text in both themes;
- light surfaces always receive dark-enough text;
- theme changes propagate to Cesium overlays, charts, cards, inputs, dialogs, menus, agent messages and status indicators;
- no dark-text-on-dark-panel or low-contrast metadata;
- all interactive controls retain visible focus states;
- System theme responds to OS changes;
- reduced-motion preference remains respected.

Theme acceptance requires automated screenshots/contrast assertions for representative desktop/tablet/mobile states in both light and dark modes.

## 5. View-mode system

All view modes operate on the same real geography, selected entities, time, providers and session.

### LIVE / REALITY

Purpose: “What is happening now?”

- real terrain/buildings;
- weather;
- live mobility;
- infrastructure;
- live entities;
- source badges;
- subtle cinematic motion.

### WIREFRAME

Purpose: “How is this environment structured?”

- terrain/building edge treatment;
- luminous structural outlines;
- network topology;
- transparent surfaces;
- route vectors;
- node pulses;
- no fake replacement geometry.

### TELEMETRY

Purpose: “Where are the signals and pressure points?”

- live flow lines;
- vectors;
- density fields;
- anomaly pulses;
- source/freshness indicators;
- domain-specific motion.

### 4D / TIME

Purpose: “How does this evolve?”

- LIVE / historical / forecast / scenario temporal modes;
- time scrubber;
- time-indexed trails;
- fading previous states;
- provider-backed forecast states;
- explicit distinction between observed, interpolated, forecast and hypothetical state.

### HOLOGRAPHIC

Purpose: high-end spatial synthesis.

- translucent/holographic material treatment;
- depth-emphasized entities;
- restrained scan/energy effects;
- contextual data glyphs;
- same underlying real world.

### SCENARIO

Purpose: compare baseline with hypothetical outcomes.

- baseline remains visible;
- scenario never relabeled as live;
- delta visualization;
- agent/solver outputs;
- reproducible assumptions.

## 6. Cinematic motion system

Motion must be HQ, elegant and modern, not noisy.

Core motion language:

- physically plausible easing;
- camera inertia;
- layered depth/parallax;
- subtle bloom/glare;
- animated flow lines;
- temporal trails;
- low-amplitude data pulses;
- atmosphere/weather transitions;
- progressive city detail;
- smooth material transitions between Reality/Wireframe/Telemetry/Holographic;
- non-blocking startup choreography.

Launch sequence:

1. ÆTHERGRID mark resolves.
2. Globe materializes.
3. current solar lighting locks.
4. maintained city nodes illuminate.
5. live feeds appear progressively.
6. agents and provider states become active.
7. chrome settles into its operational layout.

Default graphics target is HQ. Adaptive performance tiers reduce expensive effects on weaker hardware without changing data semantics or interaction.

## 7. Automatic startup/runtime orchestration

On application open, the backend and UI automatically:

- establish the operator session;
- load safe persistent preferences;
- load provider/runtime health;
- initialize Cesium;
- load global live context;
- restore enabled layers;
- start event/SSE or bounded polling loops;
- initialize agent capability/model status;
- initialize plugin registry;
- discover IBM Quantum backends when configured;
- initialize evidence/runtime receipts;
- establish voice readiness without opening the microphone;
- restore MCP connection metadata without silently granting new scopes.

Actions that must **not** execute automatically:

- paid/scarce hardware quantum submission;
- new external write permission;
- physical-grid actuation;
- destructive external action;
- new MCP authorization;
- high-impact broker/financial action.

## 8. Universal Operational Data Fabric

ÆTHERGRID must accept heterogeneous real-time, historical and forecast data without hard-coding each source into the UI.

Supported adapter classes:

- REST;
- WebSocket;
- SSE;
- webhooks;
- MQTT;
- Kafka/event streams;
- SQL/warehouse queries;
- files/object storage;
- MCP tools/resources;
- IoT gateways;
- SCADA/control gateways;
- provider SDKs.

Every provider normalizes into a canonical state/event envelope containing:

- provider;
- dataset;
- entity id/type;
- geometry/location when applicable;
- observation/event time;
- received time;
- value(s) + units;
- relationships;
- confidence/quality;
- live/stale/fallback state;
- provenance;
- permissions;
- licensing/usage class;
- raw source receipt reference.

Spatial data attaches directly to the globe. Non-spatial entities live in the same semantic graph and connect to places, facilities, routes, markets, customers, products and events when a verified relationship exists.

## 9. KPI and analytical engine

KPIs are first-class objects, not ad hoc LLM calculations.

A KPI definition contains:

- domain;
- formula/transform;
- required metrics;
- dimensions;
- time window;
- baseline;
- target;
- thresholds;
- units;
- confidence requirements;
- visualization;
- permitted action class.

The engine computes:

- current value;
- trend;
- baseline delta;
- anomaly;
- forecast;
- target variance;
- correlations;
- confidence;
- recommended action eligibility.

Core tools:

- `metrics.query`
- `kpi.calculate`
- `kpi.compare`
- `kpi.explain`
- `anomaly.detect`
- `correlation.analyze`
- `forecast.run`
- `scenario.simulate`
- `action.propose`

## 10. Domain Pack SDK

A domain pack contributes:

1. data adapters;
2. normalized schemas;
3. KPI definitions;
4. Cesium visualization layers;
5. unique animation language;
6. agent tools;
7. voice intents;
8. MCP tools/resources;
9. evidence rules;
10. action permissions.

Domain packs are installable/extensible so “all industries” does not become one unmaintainable code path.

### 10.1 Initial domain catalog

The platform architecture must account for at least:

- Air Traffic / Aviation;
- Maritime / Shipping;
- Rail / Transit / Ground Mobility;
- Energy & Utilities;
- Weather / Climate / Disaster;
- Financial Markets & Economics;
- Logistics / Supply Chain;
- Manufacturing / Industrial;
- Telecom / Networks;
- Cyber / IT / Cloud;
- Healthcare Operations;
- Retail / Commerce;
- Real Estate / Smart Buildings / Cities;
- Agriculture / Water / Food;
- Business Operations / CRM / ERP / Finance;
- Public Safety / Emergency Operations;
- Environmental / Hydrology / Air Quality;
- Space / Satellite / Geospatial observations.

Not all packs need every live provider in the first release. The platform must be structurally capable of adding them without rewriting the command center.

## 11. Domain-specific animation language

Every domain must look meaningfully different while remaining visually coherent.

Examples:

### Aviation
- moving 3D aircraft;
- altitude layers;
- heading/velocity vectors;
- fading flight trails;
- airport flow arcs;
- weather intersection highlights.

### Maritime
- 3D vessels;
- wakes/trails;
- port arrival/departure streams;
- shipping-lane flows;
- congestion density.

### Ground mobility
- moving trains/buses/vehicles only from verified position feeds;
- route flow;
- station pulses;
- congestion/incident fields.

### Energy
- power-flow lines;
- generation nodes;
- load intensity;
- renewable production pulses;
- outage/congestion visualization.

### Weather/climate
- cloud/precipitation volumes;
- storm movement;
- wind vectors;
- temperature fields;
- flood/fire/hazard boundaries.

### Financial markets
- geographically anchored market/exchange pulses;
- capital/commodity flow arcs;
- volatility/stress fields;
- sector/factor relationship networks;
- time-synchronized market events.

### Logistics
- moving shipments/vehicles/vessels;
- warehouse/port pulses;
- inventory and delay heat fields;
- route risk animation.

### Telecom
- tower/network nodes;
- traffic arcs;
- congestion propagation;
- outage/reroute animation.

### Cyber
- network/topology graph overlays;
- event pulses;
- attack-path/containment visualization;
- source/target relationship flows.

### Manufacturing
- facility/digital-twin telemetry;
- production state;
- downtime/maintenance pulses;
- process flow.

### Retail/business
- demand/revenue/stock/pipeline flows;
- facility/store/region performance;
- KPI change animation rather than pretending abstract finance data is physical traffic.

## 12. Air Traffic reference domain

Air Traffic is the first reference implementation of the Domain Pack SDK.

### 12.1 Canonical aircraft state

Fields include:

- ICAO hex;
- callsign;
- verified operator/airline;
- verified consumer-facing flight identity when available;
- registration;
- aircraft type;
- latitude/longitude;
- barometric/geometric altitude;
- ground speed;
- heading/track;
- vertical rate;
- squawk;
- on-ground state;
- observation time;
- source freshness;
- provider/provenance.

### 12.2 Visualization

Global LOD:
- lightweight instanced/glyph aircraft;
- density;
- selected labels.

Regional LOD:
- oriented low-poly 3D aircraft;
- altitude-correct paths;
- contextual labels.

Airport/city LOD:
- higher-detail aircraft;
- approach/departure flows;
- selected aircraft telemetry.

Displayed labels must not invent commercial flight numbers. Use callsign/operator unless enrichment confirms flight identity.

### 12.3 Truth model

- OBSERVED POSITION = provider sample.
- VISUAL INTERPOLATION = smooth movement between observed samples.
- PREDICTED POSITION = only a separately labeled model/route prediction.

## 13. Market/economic domain

Current `main` has source-backed EIA regional electricity fuel-mix context; it is not yet a general financial-market platform.

The Markets pack must be provider-neutral and support, when configured/licensed:

- equities;
- ETFs;
- FX;
- crypto;
- futures;
- options;
- rates;
- commodities;
- indices;
- fundamentals;
- filings;
- macroeconomic indicators;
- sentiment/news signals;
- exchange/order-book data where licensed.

Example KPIs:

- return/volatility;
- drawdown;
- beta;
- Sharpe/Sortino;
- VaR/CVaR;
- liquidity/spread;
- correlation;
- factor exposure;
- option Greeks;
- term structure;
- commodity basis;
- market breadth;
- sector stress;
- cross-market divergence.

Financial execution, if ever enabled, is a separate high-risk action class requiring explicit integration, scopes and authorization. Analysis must not imply brokerage capability when none is configured.

## 14. Agentic intelligence architecture

AUREN, VÆLON, SOLVÆR and TEAM are real tool-using agents.

### AUREN

Role:
- semantic analysis;
- spatial intelligence;
- topology;
- resilience;
- cross-domain correlation;
- anomaly/event interpretation.

Target Groq model:
- `qwen/qwen3.8-27b`, with a tested fallback path.

### VÆLON

Role:
- bounded optimization;
- constraints;
- scenario exploration;
- tradeoff analysis;
- classical/quantum problem formulation.

Target Groq model:
- `openai/gpt-oss-120b`.

### SOLVÆR

Role:
- simulation;
- reproducibility;
- evidence;
- validation;
- uncertainty;
- baseline comparison.

Target Groq model:
- `qwen/qwen3.8-27b`, with a tested fallback path.

### TEAM

Role:
- orchestration;
- specialist reconciliation;
- tool selection;
- final operator synthesis;
- disagreement/missing-evidence handling.

Target Groq model:
- `openai/gpt-oss-120b`.
- an alternate team-specialized model may be enabled only when account access, stability and acceptance are verified.

### Shared context

All agents receive the same bounded, structured session context:

- active geography;
- selected entity;
- temporal mode/time;
- live provider receipts;
- current domain;
- active KPIs;
- workset;
- scenario;
- source confidence/freshness;
- permitted tools.

Changing visual mode does not reset agent context.

## 15. Plugin/capability system

Every agent gets a discoverable capability registry.

Plugin metadata includes:

- name/id;
- provider;
- tool schemas;
- required permissions;
- allowed agents;
- risk class;
- auth mode;
- enabled state;
- health;
- provenance/evidence rules.

Examples:

- `weather.current`
- `weather.forecast`
- `weather.alerts`
- `city.inspect`
- `transit.realtime`
- `scenario.create`
- `optimization.solve`
- `quantum.backends`
- `quantum.sampler`
- `evidence.verify`
- `control.stage`

Users direct agents through natural language, voice or UI actions; the agent selects only tools it is allowed to use.

## 16. MCP integration

ÆTHERGRID must support MCP in both directions.

### 16.1 ÆTHERGRID as MCP server

External MCP-capable AI systems can discover scoped ÆTHERGRID tools/resources.

Tool groups include:

- world/camera/layers;
- domain data;
- agents;
- KPIs;
- scenarios;
- quantum;
- evidence;
- staged control.

### 16.2 ÆTHERGRID as MCP client

Under **Settings → Integrations → MCP**, users can connect their own MCP servers.

Connected tools become capabilities that can be assigned to selected agents.

Users can choose:

- allowed agents;
- read/write level;
- domain;
- scope;
- approval requirements.

MCP connections never silently receive physical-control authority.

## 17. Bring-your-own AI providers

Settings supports replaceable model backends without changing agent identity:

- Groq/OpenAI-compatible;
- OpenAI;
- Anthropic;
- Gemini;
- Azure/OpenAI-compatible;
- Ollama/local;
- organization-specific endpoints.

Provider secrets remain server-side. The browser sees safe status/model metadata only.

## 18. Voice command layer

Voice is a first-class input into the same command/tool bus used by UI, agents and MCP.

Flow:

microphone → speech-to-text → intent/agent routing → tool registry → policy check → action → visual/spoken confirmation.

Initial approach:

- push-to-talk;
- Groq Whisper Turbo when configured;
- optional browser/local speech synthesis for spoken responses;
- no continuous microphone capture by default.

Example commands:

- “AUREN, analyze the selected building.”
- “Switch Tokyo to wireframe.”
- “Show air traffic and weather.”
- “VÆLON, create three resilience scenarios.”
- “SOLVÆR, verify scenario two.”
- “TEAM, summarize this region.”
- “Go live.”
- “Show the last six hours.”

Voice does not bypass authorization.

## 19. Quantum architecture

### IBM

Existing IBM authentication/discovery remains server-side.

The Quantum panel should show:

- provider health;
- discovered backends;
- hardware/simulator state;
- queue/status when available;
- local/classical baseline;
- workload configuration;
- jobs/history/results.

Real hardware submissions require explicit operator action and evidence.

### Qiskit AI skill

The uploaded IBM/Qiskit skill is a **migration skill** for modernizing `qiskit-ibm-runtime` usage. It is useful developer/agent capability but is not itself the workload engine.

It belongs in the agent-skill registry as a developer/quantum migration capability.

ÆTHERGRID itself supplies workload-building, Sampler/Estimator, optimization mapping and result-comparison tools.

### D-Wave

Build the provider/UI/tool integration now against the provider interface.

Until SAPI credentials are actually granted:

- provider state = pending/unconfigured;
- no fake readiness;
- local/classical alternatives remain usable;
- no redesign is required when the token arrives.

## 20. Agentic action and control model

Authority ladder:

1. OBSERVE
2. ANALYZE
3. SIMULATE
4. RECOMMEND
5. STAGE
6. EXECUTE BOUNDED ACTION
7. CRITICAL CONTROL

Agents may operate freely inside the digital twin according to tool permissions.

Real-world actions go through:

agent intent → structured ActionPlan → policy engine → simulation/safety checks → authorization → deterministic control gateway → target system → telemetry verification → evidence receipt.

LLMs never directly emit raw unvalidated device-control traffic.

The same model applies to high-impact financial, infrastructure, cyber or enterprise actions.

## 21. Free-tier and cost-aware runtime

Auto-starting the application must not mean wasteful polling.

Required scheduler behavior:

- current camera/selected domain gets highest refresh priority;
- background cities use cached/low-frequency state;
- provider TTLs are respected;
- duplicate users can share cached public/provider snapshots where terms allow;
- WebSocket/SSE preferred when supported;
- backoff/circuit breakers on rate limits/errors;
- user-visible stale/fallback state;
- per-provider quota telemetry.

The architecture must allow provider replacement when free/non-commercial terms are insufficient for production.

## 22. Evidence, provenance and observability

Every live/provider/agent/action event should be traceable.

Required receipts include:

- source/provider;
- dataset;
- request/job id when safe;
- observed/source time;
- retrieved time;
- freshness;
- fallback state;
- transformation/interpolation state;
- agent/model/tool identity;
- action plan;
- approval state;
- result;
- error/retry state.

Secrets are never included in evidence exports or browser configuration.

## 23. Testing and acceptance

### UI

- desktop/tablet/mobile;
- dark/light/system;
- no page scroll;
- keyboard/touch;
- reduced motion;
- contrast;
- panel functionality;
- no placeholder/toast-only controls.

### Cesium

- global globe;
- maintained cities at correct coordinates;
- terrain;
- OSM buildings;
- optional reality tiles;
- globe→city journey;
- view-mode transitions;
- live overlays.

### Agents

- per-agent model identity;
- distinct prompts/roles;
- real provider response;
- tool calls;
- plugin permissions;
- TEAM receives all specialist contributions;
- fallback truth.

### Data fabric

- source normalization;
- units;
- timestamp/freshness;
- stale/fallback;
- schema evolution;
- cache/rate-limit behavior.

### Voice

- transcription;
- agent routing;
- deterministic command mapping;
- authorization boundary.

### MCP

- discovery;
- OAuth/scopes;
- read-only tool use;
- write/stage authorization;
- no control-scope escalation.

### Quantum

- backend discovery;
- local simulation;
- explicit real-job submission;
- job polling/results;
- no auto hardware submission.

### Control

- simulation;
- approval;
- rejected unsafe/unauthorized action;
- telemetry/evidence confirmation.

## 24. Phased delivery roadmap

This roadmap is architectural sequencing. The task-level implementation plan follows after this written design is approved.

### Phase 0 — Canonical-product convergence

- make React/Cesium the only primary launch;
- move old native/operator UI to explicit legacy/reference status;
- remove confusing duplicate entrypoints;
- preserve deterministic packaging/smokes.

### Phase 1 — UX foundation and light-mode repair

- semantic theme tokens;
- complete light/dark/system treatment;
- scrollless shell;
- responsive panel sizing;
- accessible focus/contrast;
- eliminate dark-on-dark text;
- panel-level control patterns.

### Phase 2 — Real Settings

- Appearance;
- Graphics & Motion;
- Data & Refresh;
- providers/models;
- Plugins;
- MCP;
- Voice;
- Quantum;
- permissions/control;
- persistent non-secret settings.

### Phase 3 — Auto-bootstrap runtime

- one startup orchestrator;
- provider readiness;
- Cesium initialization;
- agent readiness;
- IBM discovery;
- evidence/session restore;
- safe live subscriptions.

### Phase 4 — Unified view-mode renderer

- Reality;
- Wireframe;
- Telemetry;
- 4D;
- Holographic;
- Scenario;
- shared state and no scene duplication.

### Phase 5 — Universal event/data fabric

- canonical event schema;
- adapter SDK;
- event bus;
- source receipts;
- temporal storage/cache;
- streaming/polling abstractions.

### Phase 6 — KPI engine

- KPI registry;
- transforms;
- baselines;
- anomaly/correlation;
- forecast/scenario hooks;
- visual presentation API.

### Phase 7 — Domain Pack SDK

- pack manifest;
- data adapters;
- KPI bundle;
- visualization bundle;
- tools;
- voice intents;
- MCP exposure;
- action policies.

### Phase 8 — Agentic runtime upgrade

- per-agent strongest-role model assignments;
- persistent agent status;
- tool calling;
- shared context;
- inter-agent handoffs;
- TEAM orchestration;
- startup readiness.

### Phase 9 — Plugin registry

- capability discovery;
- permission assignment;
- health;
- audit/evidence;
- agent-specific tool visibility.

### Phase 10 — MCP server/client

- Settings-only MCP management UI;
- remote server transport/auth;
- scoped tool catalog;
- user MCP connections;
- plugin bridge.

### Phase 11 — Voice

- push-to-talk;
- Groq transcription;
- command router;
- agent routing;
- visual confirmation;
- optional speech response.

### Phase 12 — Quantum workspace

- production IBM workload UI;
- guarded real jobs;
- Qiskit migration skill in agent registry;
- classical comparison;
- D-Wave integration shell pending SAPI token.

### Phase 13 — AIR TRAFFIC reference pack

- live ADS-B provider interface;
- aircraft state schema;
- 3D LOD planes;
- labels;
- trails/vectors;
- airport flows;
- aviation KPIs;
- agent/voice/MCP tools;
- provider/licensing abstraction.

### Phase 14 — Financial Markets pack

- provider-neutral market schemas;
- securities/FX/crypto/commodities/rates/options;
- market KPI library;
- geographic/cross-domain visualization;
- no brokerage action without explicit integration.

### Phase 15 — Mobility/Maritime/Logistics packs

- rail/transit;
- ground mobility;
- ships/ports;
- freight/logistics;
- unique movement animations;
- verified position data only.

### Phase 16 — Energy/Climate/Public-safety expansion

- richer grid/load/market data;
- hazards;
- weather volumes;
- hydrology;
- emergency operations;
- scenario/control tools.

### Phase 17 — Industrial/enterprise packs

- manufacturing;
- telecom;
- cyber/IT;
- healthcare operations;
- retail;
- real estate/smart buildings;
- agriculture;
- business operations.

### Phase 18 — Governed action gateway

- ActionPlan schema;
- policy engine;
- scope/approval engine;
- simulation-before-control;
- deterministic adapters;
- telemetry verification;
- evidence receipts.

### Phase 19 — Cinematic performance pass

- HQ animation;
- instancing/LOD;
- GPU budgets;
- adaptive quality;
- smooth domain transitions;
- reduced-motion equivalents;
- cinematic startup/city descent.

### Phase 20 — Production hardening

- security;
- quota/cost controls;
- licensing status;
- provider failover;
- deployment secrets;
- observability;
- load tests;
- accessibility;
- browser/device matrix;
- protected canonical live acceptance.

## 25. Success criteria

The vNext architecture is successful when:

- a normal user opens one ÆTHERGRID app and the system initializes automatically;
- the central globe is real 3D Cesium with true city locations;
- every visible operational control works;
- Light mode is fully legible;
- view changes alter presentation, not truth/context;
- domains can install without rewriting the command center;
- each domain has unique data-driven animation;
- Air Traffic shows real moving 3D aircraft from source-backed positions;
- agents use role-appropriate models and real tools;
- users can direct agents by UI, text and voice;
- users can connect their own MCP-capable AI systems through Settings;
- plugins extend agent capability safely;
- IBM workloads can be run deliberately without CLI;
- D-Wave can activate when SAPI access arrives without rearchitecture;
- KPIs are calculated by a deterministic engine before agent explanation;
- external actions are governed, auditable and permission-scoped;
- source provenance/freshness is preserved everywhere;
- no synthetic/inferred state is mislabeled as live observation.
