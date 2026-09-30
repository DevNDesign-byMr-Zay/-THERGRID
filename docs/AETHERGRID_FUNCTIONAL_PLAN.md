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
Status: COMPLETE

Deliver:
- full-screen spatial workspace;
- WebGL camera presets;
- selectable topology, assets, routes, risk, flow and future-state layers;
- temporal compare/split state;
- node inspector;
- saved camera views;
- exportable spatial scene data.

### Batch 5 — Quantum workspace
Status: COMPLETE

Deliver:
- objective selector;
- weighted cost/emissions/reliability/renewable controls;
- constraint editor;
- classical vs experimental comparison;
- run history;
- immutable receipt per run;
- visualization of objective landscape and selected candidate.

### Batch 6 — Evidence, scenarios and operator workflow
Status: COMPLETE

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
Status: COMPLETE

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


## Current verified state

Batches 1–13 are implemented; Batch 13 has passed the maintained feature-branch gates and the exact merge candidate must remain green before entering `main`.

- Grid, Global, Holographic, Quantum, AI, Scenarios, Evidence and Settings are distinct routed workspaces.
- WebGL node picking, scenario editing/duplication, evidence drill-down, agent receipts, persistent settings/profile, global coordinate exploration, mapped grid infrastructure, terrain and quantum provider workflows are all present.
- The Windows launchers, backend-connected app and direct-open standalone HTML are packaged from the same maintained source.
- The runtime continues to enforce advisory-only behavior with physical actuation and infrastructure dispatch disabled.

## Verified package checkpoint

The CI-built functional application archive was inspected after the final release gates passed:

- 28 regular files;
- 0 empty files;
- includes `standalone.html`, modular HTML/CSS/JS, Node backend, provider-neutral AI runtime, agent config, JSON manifests, brand assets, app-local environment example, PowerShell/CMD launchers, README, file inventory and SHA-256 sums;
- the old dashboard screenshot is not required by the runtime package;
- tests, lint, typecheck, coverage, fresh-clone smoke, container smoke, quality/release-readiness and CodeQL are required before merge.
- v2.6 verified functional ZIP: 684,707 bytes; SHA-256 `ea253b688d9c5195f99cdc5a3b79e020d697023d48772b63c2ef0fb783d4e3a6`.
- v2.7 verified functional ZIP: 750,259 bytes; SHA-256 `9bac618a2b451e9e8795883b72b6c61ca03be93a9adb7175065d77e6c3a488a2`.

## Batch 8 — Global intelligence, operator identity, and external compute

Status: COMPLETE

### Global God's-eye grid
- native-WebGL planetary latitude/longitude grid;
- real-coordinate world city nodes;
- orbit, zoom, point selection and city focus;
- explicit operator-triggered city descent;
- live OpenStreetMap Overpass building footprints;
- building-height extraction and metric projection;
- interactive 3D wireframe city extrusion;
- provider attribution and cached requests;
- explicit fallback labeling when live geometry is unavailable.

### Operator profile
- editable profile dialog;
- persistent local JSON store;
- browser cache fallback;
- client-side avatar resize;
- bounded avatar/profile payloads;
- no profile field grants infrastructure authority.

### Quantum compute
- credential-free local Sampler fallback;
- IBM Cloud IAM token exchange;
- IBM Quantum backend discovery;
- OpenQASM 3 editor;
- Sampler V2 job submission;
- remote job listing and job detail retrieval;
- job/evidence receipts;
- explicit separation between hardware submission and completed QPU execution.

### Next expansion
- configurable commercial/self-hosted geospatial providers for higher-volume deployments;
- terrain-aware building bases and transmission-line draping;
- topology relationship inference across substations, lines, generation and load;
- weather and renewable-resource overlays behind separately attributed adapters;
- additional quantum providers behind the provider-neutral runtime;
- authenticated multi-user profile/session boundaries for hosted deployments.

## Batch 9 — Global grid intelligence and shared agent context

Status: COMPLETE

### Arbitrary coordinate exploration
- operator-entered latitude/longitude;
- bounded 250 m–2 km local radius;
- custom coordinate nodes injected into the live globe session;
- animated globe-to-coordinate descent;
- same interactive city WebGL renderer used by preset cities.

### Real mapped grid layers
- live OpenStreetMap building footprints;
- live road topology;
- live mapped power line / minor-line / cable geometry;
- live mapped substation / plant / generator / transformer assets;
- independent BUILDINGS / ROADS / POWER GRID / ASSET NODES controls;
- power metadata such as voltage, circuits and operator preserved when present;
- deterministic local fallback power topology for standalone/offline mode;
- visible source attribution and fallback state.

### Live terrain elevation
- bounded real-coordinate elevation sampling through a replaceable terrain adapter;
- Open-Meteo elevation provider backed by Copernicus DEM GLO-90;
- independent TERRAIN layer in the city renderer;
- visible min/max elevation summary and terrain provenance;
- flat local fallback in standalone/offline mode;
- terrain provider credentials remain server-side.

### 4D city review
- city renderer retains x/y/z geometry plus time-phase animation;
- GLOBAL workspace exposes a dedicated 24-hour time index;
- time affects spatial animation without altering source provenance.

### Shared agent context
- last loaded geospatial summary becomes bounded AI context;
- last quantum submission/result state becomes bounded AI context;
- individual agents and team synthesis receive the same external-context envelope;
- credentials, bearer tokens, and actuation authority never enter that envelope.

### Verification requirements
- parser tests cover OSM buildings, roads, power lines and power assets;
- custom coordinate validation is tested;
- standalone fallback contains buildings, roads and power topology;
- HTML/app manifests advertise the new controls and routes;
- ZIP assembly fails if coordinate or power-grid controls disappear;
- release-readiness fails if the live power parser, coordinate endpoint, or agent context disappears.

### Next expansion
- transmission/asset relationship graph inference from source topology;
- weather/renewables overlays behind separately attributed adapters;
- hosted multi-user authentication/session boundary;
- additional quantum providers behind the provider-neutral runtime;
- richer quantum result charts and estimator workflows.

## Batch 10 — Terrain-aware spatial intelligence

Status: COMPLETE

### Live elevation
- provider-neutral `terrain-runtime.mjs`;
- default Open-Meteo Elevation adapter;
- Copernicus DEM GLO-90 attribution;
- bounded 3×3–9×9 elevation sampling around selected coordinates;
- local metric projection aligned with city geometry;
- independent TERRAIN WebGL layer;
- elevation min/max readout in GLOBAL workspace;
- explicit flat-local fallback when the provider cannot be reached.

### Packaging and safety
- terrain runtime is a required non-empty ZIP file;
- standalone HTML retains terrain controls and native WebGL terrain code;
- provider credentials remain server-side;
- runtime summary never serializes terrain API secrets;
- terrain context passed to agents is bounded to source/readout metadata;
- physical actuation and infrastructure dispatch remain disabled.

### Next expansion
- terrain-aware building base elevation and transmission-line draping;
- relationship graph inference across mapped substations, lines and generation assets;
- weather and renewable-resource overlays behind separately attributed adapters;
- hosted multi-user authentication/session boundary;
- additional quantum providers and richer result visualizations.

## Batch 11 — Solid live cities, operational use cases, and dedicated agent threads

Status: COMPLETE

### Solid live 3D cities
- OSM building footprints are extruded into translucent WebGL triangle surfaces instead of wireframe-only shells;
- wireframe edges remain available for readable topology and X-ray review;
- OSM building:part and minimum-height metadata are retained when present;
- SOLID 3D, X-RAY and OPERATIONS visual modes change real renderer behavior;
- globe selection performs a cinematic planetary descent and a second local city fly-in while geometry/terrain load.

### Operational city use cases
- Grid Resilience;
- Outage Impact;
- Emergency Access;
- Renewable Siting;
- Load Growth.

Each workflow analyzes the currently loaded bounded city mesh, returns transparent map-derived metrics and a 0–100 planning proxy, recommends renderer layers, creates an evidence receipt, and adds the result to bounded AI context. These indicators are decision-support proxies, not operational truth or physical actuation.

### Dedicated AI chats
- TEAM, VÆLON, AUREN and SOLVÆR each retain an independent browser-side conversation thread;
- the active thread sends only a bounded recent history window to its existing provider-neutral backend route;
- selecting another agent changes to that agent's own transcript instead of reusing the shared log;
- city-operation context can be handed to TEAM mode for coordinated specialist review;
- provider configuration remains replaceable and secrets remain server-side.

### Verification requirements
- semantic HTML must expose the cinematic transition, visual modes, city-use-case controls and thread state;
- native WebGL source must contain solid city triangle geometry in addition to wireframe topology;
- geospatial tests must prove building-part and minimum-height parsing;
- city-operation tests must prove all five workflows stay bounded and advisory-only;
- agent-thread UI must preserve separate history while backend agent/team routes remain unchanged;
- all pre-existing tests, coverage, lint, typecheck, smoke, release-readiness, package and CodeQL gates must remain green.

## Batch 12 — Source-backed skyline fidelity, live city context, and appearance modes

Status: COMPLETE

### City-specific 3D/4D identity
- preset city coordinates target recognizable skyline districts rather than generic centroids;
- OpenStreetMap ways and relation outer geometry are accepted for buildings and building parts;
- source-backed height supports `height`, `est_height`, `building:levels`, `min_height`, and `building:min_level`;
- the former 450 m renderer cap is removed; verified source heights are preserved up to a defensive 1,200 m ceiling;
- supported source roof shapes and roof heights generate native WebGL roof surfaces/lines;
- dense city samples preserve source-backed tall/complex structures before spatially sampling the remainder;
- each city fly-in derives camera yaw from its footprint distribution and distance/pitch from its skyline profile;
- skyline max, P95 height, source-backed height coverage, building-part count, roof coverage and upstream timestamp remain explicit metadata.

### Current open-data context
- OpenStreetMap Overpass remains operator-triggered and attribution-bound;
- upstream OSM timestamp is retained when returned by Overpass;
- `city-environment-runtime.mjs` adds current Open-Meteo temperature, apparent temperature, weather code, cloud cover, daylight, precipitation, wind speed and wind direction;
- terrain remains bounded Open-Meteo Elevation / Copernicus DEM GLO-90 sampling;
- city 4D time synchronizes to current local model time when environment context is available;
- LIVE NOW restores the current city time after temporal exploration;
- provider timestamps and fallback state are visible rather than represented as live when unavailable.

### Appearance
- Settings expose Dark, Light and System modes;
- appearance persists in the existing local settings store;
- System mode reacts to operating-system color preference changes;
- semantic panels, controls and native WebGL city/globe palettes respond to the resolved theme.

### Fidelity boundary
The city twin is only as exact as the open-source geometry and metadata available for the selected coordinate. ÆTHERGRID must never invent an unverified landmark, façade, roof dimension or hardware state and then label it as source-backed. Missing data remains visible through coverage/provenance readouts or an explicit fallback state.

### Verification requirements
- tests prove an 828 m source height is not flattened and imperial heights are converted correctly;
- tests prove relation building geometry and roof metadata survive parsing;
- tests prove current environment data maps through the provider-neutral runtime without browser secrets;
- release readiness requires roof buffers, city-specific camera framing, live-time controls and Light/Dark/System settings;
- the full ZIP requires the new city environment runtime as a non-empty file;
- all existing safety, coverage, smoke, packaging and CodeQL gates remain mandatory.

## Batch 13 — Live animated cities, globe intelligence, and source-driven use cases

Status: COMPLETE

### Animated planet
- secondary native-WebGL atmospheric shell;
- current UTC sweep around the globe;
- current modeled AQI pulses for maintained world-city nodes;
- recent USGS M2.5+ event pulses grouped by magnitude;
- global live-context badge showing city AQ coverage and seismic-feed activity;
- live-context rendering remains separate from base city coordinates and OpenStreetMap geometry.

### Animated city atmosphere
- wind vectors derive from current modeled wind speed and direction;
- precipitation streak density derives from current precipitation and leans with wind;
- air-quality particles derive from current modeled US AQI and change visual emphasis by AQ category;
- nearby seismic events render as directional pulsing rings using real event coordinates, distance and magnitude;
- WEATHER / AIR / SEISMIC are independent WebGL layers;
- reduced-motion preference suppresses pulse animation while preserving source state.

### Source-driven city operations
Eight maintained workflows:
- Grid Resilience;
- Outage Impact;
- Emergency Access;
- Renewable Siting;
- Load Growth;
- Weather Readiness;
- Air Quality Exposure;
- Seismic Awareness.

Each workflow combines only the bounded sources relevant to the operation, returns transparent metrics/live signals, selects renderer layers, selects an animation profile, records a receipt and remains advisory-only. Weather/AQ/seismic context never becomes physical authority.

### Live-source adapters
- current Open-Meteo weather context;
- current Open-Meteo Air Quality / CAMS context;
- USGS M2.5+ past-day GeoJSON feed with a bounded one-minute local cache;
- OpenStreetMap geometry and infrastructure remain separately attributed;
- explicit local fallback structures are returned when a provider cannot be reached.

### Verification requirements
- unit tests must exercise Air Quality and USGS adapters without external network dependencies;
- city-operation tests must exercise all eight workflows with live-source fixtures;
- semantic HTML must expose all three live layers and three new use cases;
- native WebGL source must preserve globe AQ/seismic pulses plus city wind/rain/AQ/seismic geometry;
- release readiness must require the new routes, manifests, environment variables and `city-live-runtime.mjs`;
- the full app ZIP must include the live-context runtime as a non-empty file;
- test, lint, typecheck, coverage, fresh-clone, container, quality/release-readiness, package and CodeQL gates must remain green.

### Accuracy boundary
The animated layers visualize the freshest bounded feed/model data received by ÆTHERGRID. They are not synthetic claims of street-level sensing. Model weather/AQ resolution and source timestamps remain visible, seismic events are geospatial context rather than damage predictions, and absent live data must remain absent or explicitly fallback.
