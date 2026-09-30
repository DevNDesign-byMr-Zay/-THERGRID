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

Batches 1–16 are verified on `main`; Batch 17 is implemented on the feature branch and must pass the maintained gates before entering `main`.

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

## Batch 14 — Solar city identity, atmospheric motion, and environmental operations

Status: COMPLETE

### Real-time solar globe
- current subsolar latitude/longitude is calculated from UTC solar declination and equation of time;
- the globe renders a live day/night terminator independently from the UTC longitude sweep;
- the subsolar point is rendered as a dedicated live marker;
- maintained cities on the night side gain a separate illumination marker layer;
- solar geometry is recomputed on a bounded minute cadence and is not presented as astronomical ephemeris-grade output.

### City-specific atmosphere and light
- Open-Meteo modeled cloud cover controls a separate cloud-particle deck;
- cloud motion is driven by current wind direction/speed through shader flow uniforms;
- weather vectors now translate directionally through the city scene;
- precipitation receives independent wind drift and downward fall motion;
- source-backed building geometry produces procedural skyline light anchors;
- procedural lights respond to modeled day/night state and do not represent measured occupancy, window state, or utility demand.

### Expanded environment context
- relative humidity;
- surface pressure;
- sunrise and sunset;
- daylight duration;
- sunshine duration;
- existing temperature, apparent temperature, cloud, precipitation, wind, gust, radiation, visibility, AQI, and seismic context remain available.

### Environmental operations
Ten maintained workflows now include:
- Heat Stress;
- Visibility Operations;
- the eight existing v2.7 workflows.

Heat Stress combines apparent temperature, modeled relative humidity, UV, and mapped built density into a bounded attention proxy. Visibility Operations combines modeled visibility, cloud, precipitation, AQI, mapped roads, and built form into a bounded operational-context proxy. Neither result is an operational clearance or health diagnosis.

### Verification requirements
- environment-runtime tests must prove humidity, pressure and daily solar fields are requested and mapped;
- semantic UI tests must require CLOUDS, CITY LIGHTS, solar status, Heat Stress and Visibility Operations controls;
- WebGL source tests must require cloud particles, procedural city lights, directional flow and precipitation drop uniforms;
- city-operation tests must exercise all ten maintained workflows with bounded live-context fixtures;
- packaging must preserve solar calculations, atmosphere motion and both new operations in standalone HTML;
- release-readiness must require all v2.8 manifest capabilities and fidelity disclaimers;
- all test, lint, typecheck, coverage, fresh-clone, container, package, quality/release-readiness and CodeQL gates remain mandatory.

### Fidelity boundary
ÆTHERGRID continues to distinguish source-backed structure from visualization. Building geometry and supported heights/roofs come from mapped source data when available; weather and air quality remain provider model context; seismic events remain event-feed context; skyline lights and cloud particles are procedural render layers driven by those bounded inputs rather than claims of direct sensing.

## Batch 15 — Source-backed city identity and semantic weather

Status: COMPLETE

### City identity
- extend skyline profiles with source-backed named structures and tall-structure counts;
- render independent landmark points and vertical skyline spines for named/tall mapped structures;
- expose LANDMARKS as an independent city layer;
- add an interactive CITY IDENTITY inspector with skyline, terrain, roof, weather and height-coverage metrics;
- selecting an identity anchor highlights the matching renderer node;
- source-backed names and heights remain tied to the bounded OpenStreetMap sample.

### Semantic weather animation
- classify current provider weather codes into Clear / Cloudy / Fog / Rain / Snow / Thunderstorm / Mixed presentation states;
- rain retains wind drift and continuous fall;
- snow uses a separate drifting/falling point field;
- fog uses a low-altitude field scaled by modeled visibility;
- thunderstorm state adds a pulsing procedural bolt field while precipitation remains separate.

### Fidelity boundary
- a named structure is displayed only when the source building carries a name;
- unnamed tall structures may be highlighted as tall mapped geometry but are not assigned invented landmark names;
- thunder pulses indicate a modeled thunderstorm weather code, not detected strike coordinates;
- weather particles visualize provider model state and are not street-level sensors.

### Verification requirements
- geospatial tests must prove named skyline anchors survive parsing and ordering;
- semantic UI tests must require LANDMARKS, CITY IDENTITY and the weather-specific geometry paths;
- standalone packaging must retain landmark extraction, identity inspector, snow, fog and storm rendering;
- release-readiness must enforce the no-fake-landmark and no-detected-lightning claims;
- the full engineering and CodeQL gates remain mandatory before merge.

## Batch 16 — Geographic city identity reconciliation

Status: COMPLETE

### Reconciled identity stack
- preserve Batch 15 named/tall source-backed skyline anchors and semantic weather modes;
- add source-backed OSM water areas, linear waterways and coastline;
- add source-backed OSM parks and green-space polygons;
- add source-tagged building-material tint groups without replacing authoritative building geometry;
- expose WATER and GREEN as independent city layers while retaining LANDMARKS.

### New operations
- Flood Context;
- Green Infrastructure;
- maintained city-operation total: 12.

### Strict fallback
- standalone/local fallback may continue to generate clearly labeled local building/road/grid demonstration geometry;
- it must return empty water, waterway, coastline and green-space collections rather than fabricate local geography;
- material styling appears only when mapped material/colour metadata exists.

### Verification
- live OSM fixtures include a named glass tower, water polygon, river, coastline and park;
- fallback tests require zero invented water/green features;
- renderer tests retain landmark/weather identity plus water/green/material buffers;
- city-operation tests exercise all 12 workflows with mapped feature counts;
- standalone packaging and release-readiness require both the Batch 15 and Batch 16 identity contracts;
- engineering CI and CodeQL remain mandatory before merge.

### Fidelity boundary
Geographic layers improve recognizability but remain bounded to the selected OpenStreetMap sample and its completeness. A missing feature is unknown, not evidence of real-world absence. Flood/green outputs remain advisory planning context rather than physical forecasts, measurements or directives.

## Batch 17 — Terrain-conforming 3D city geometry

Status: IMPLEMENTED / VERIFYING

### Vertical city fidelity
- use bilinear interpolation across the bounded local-meter elevation grid;
- anchor each building foundation to interpolated terrain at its footprint center while keeping the foundation plane structurally flat;
- drape mapped roads and waterways per source vertex;
- drape mapped green-space polygons per vertex;
- drape mapped power lines and power-asset markers using local terrain elevation plus presentation clearance;
- keep mapped water areas level using the lowest interpolated polygon-edge elevation;
- keep coastline on the bounded terrain datum instead of warping it over inland relief.

### Runtime transparency
- GLOBAL stats expose DEM DRAPED versus FLAT FALLBACK;
- CITY IDENTITY exposes the same terrain-fit state;
- provenance explains that vertical fitting is interpolation over bounded DEM samples rather than survey/LiDAR precision;
- the server terrain contract declares `bilinear-local-grid` interpolation metadata;
- standalone fallback continues to work without claiming live elevation.

### Fidelity boundary
Copernicus DEM GLO-90 / Open-Meteo elevation is used as visualization context, not engineering-grade vertical truth. Terrain fitting does not establish legal elevation, foundation design, road grade, drainage, flood depth, water level, clearance or infrastructure safety.

### Verification requirements
- unit tests must verify bilinear interpolation at grid corners, center and an intermediate coordinate;
- WebGL source tests must require terrain-surface interpolation and terrain-conformance state;
- standalone packaging must preserve interpolation, terrain-fitting logic and Terrain Fit readouts;
- release-readiness must require the v3 terrain capabilities and non-survey-grade boundary;
- all existing city identity, semantic weather, mapped geography, agent, quantum and safety gates remain mandatory;
- test, lint, typecheck, coverage, fresh-clone smoke, container smoke, quality/release-readiness, package verification and CodeQL must pass on the exact merge head.
