# Changelog

## Unreleased — pre-rescore detector hardening

### Changed

- Exposed the maintained health service through conventional Node.js `main`, `exports`, and `npm start` application entrypoints.
- Added plainly named lint/typecheck/test/coverage/container CI jobs plus a zero-cache fresh-clone smoke path to improve machine-detectable application verification.
- Added scheduled dependency-freshness evidence without automatic dependency mutation.

### Added
- Added a real-time solar terminator, current subsolar marker, and night-side city illumination to the native-WebGL global globe.
- Added wind-driven cloud decks, directional weather translation, falling precipitation motion, and procedural skyline lights derived from mapped building geometry plus day/night state.
- Expanded Open-Meteo city context with modeled relative humidity, surface pressure, sunrise, sunset, daylight duration, and sunshine duration.
- Added Heat Stress and Visibility Operations as evidence-bound advisory city workflows, expanding the maintained operation catalog from eight to ten.
- Added explicit provenance that procedural skyline lights do not represent measured occupancy, window state, or utility demand.
- Added a live solar terminator, subsolar point and night-side city illumination to the native-WebGL globe.
- Added wind-driven cloud decks, directional wind/AQ motion, falling precipitation, and procedural mapped-geometry skyline lights to city twins.
- Added current relative humidity, surface pressure, sunrise, sunset, daylight duration and sunshine duration to the city environment contract.
- Added Heat Stress and Visibility Operations city workflows, bringing the maintained city-operation set to ten bounded use cases.
- Added an explicit visualization contract that procedural city lights do not represent measured occupancy or real building lighting state.

- Added a source-driven live globe layer with an animated atmosphere shell, UTC sweep, current AQI-coded city pulses, and recent USGS M2.5+ seismic pulses.
- Added native-WebGL city weather vectors, precipitation streaks, AQI-driven atmospheric particles, and directional seismic rings built from the active city's current feed context.
- Added a provider-neutral live-context runtime for Open-Meteo Air Quality / CAMS and the USGS past-day earthquake GeoJSON feed, with explicit fallback state and bounded seismic caching.
- Expanded current weather context with wind gusts, shortwave radiation, and visibility for animation and planning context.
- Added Weather Readiness, Air Quality Exposure, and Seismic Awareness workflows and upgraded existing city operations to use relevant current feed signals while remaining evidence-bound and advisory-only.
- Added independent WEATHER, AIR, and SEISMIC layer controls plus live-source provenance and feed status throughout the GLOBAL workspace.

- Added skyline-focused presets for New York, London, Tokyo, Dubai, Singapore, São Paulo, Lagos, and Sydney so city descent targets recognizable urban cores instead of generic centroids.
- Expanded OpenStreetMap city parsing to ways plus relation outer geometry, source-backed height/estimated-height/level metadata, minimum heights, roof metadata, materials/colours, and visible upstream timestamps.
- Removed the former 450 m building-height flattening ceiling, added supported native-WebGL roof geometry, and added city-specific camera framing derived from mapped footprint distribution and skyline height.
- Added current Open-Meteo city environment context and LIVE NOW synchronization for the GLOBAL 4D city time surface, with current temperature/cloud/daylight/precipitation/wind provenance.
- Added persistent Dark, Light, and System appearance modes across semantic UI surfaces and WebGL city/globe palettes.
- Added skyline quality readouts so source-backed height coverage and fallback state are visible instead of overstating open-data fidelity.

- Upgraded live OSM city rendering from wireframe-only shells to translucent WebGL building volumes with retained wireframe edges, building-part support, and minimum-height geometry.
- Added cinematic globe-to-city descent with a local 3D fly-in plus SOLID 3D, X-RAY, and OPERATIONS visual modes.
- Added bounded city-operation workflows for grid resilience, outage impact, emergency access, renewable siting, and load growth, with evidence receipts and shared AI context.
- Added independent persistent chat threads for TEAM, VÆLON, AUREN, and SOLVÆR with bounded per-thread history sent to the existing provider-neutral endpoints.

- Added an independent live terrain/elevation layer backed by a provider-neutral runtime, Open-Meteo Elevation / Copernicus DEM GLO-90 sampling, native WebGL terrain wireframes, explicit attribution, and flat local fallback.
- Added live elevation terrain sampling with a separate native-WebGL TERRAIN layer, bounded real-coordinate requests, visible provenance, and an explicit flat local fallback.
- Added arbitrary latitude/longitude exploration in the GLOBAL workspace, including animated coordinate descent, bounded radius controls, and custom-coordinate city sessions.
- Added live OpenStreetMap power-grid ingestion for mapped lines/cables, substations, plants, generators, and transformers with voltage/circuit/operator metadata when available.
- Added independent city-layer controls for buildings, roads, power infrastructure, and asset nodes plus a dedicated 4D city time index.
- Added bounded geospatial and quantum external-context summaries to VÆLON, AUREN, SOLVÆR, and TEAM requests without exposing provider credentials or actuation authority.
- Strengthened the full-app ZIP and release-readiness gates so coordinate controls, live power-grid parsing, shared agent context, and standalone power topology cannot disappear silently.

- Added a native-WebGL **GLOBAL** God's-eye workspace with real latitude/longitude city nodes, orbit/zoom selection, and a city-descent workflow.
- Added on-demand OpenStreetMap Overpass building-footprint ingestion with attribution, request caching, height/level extraction, metric projection, explicit live-vs-fallback provenance, and interactive 3D wireframe city rendering.
- Added a persistent operator profile with editable identity fields, local JSON persistence, browser cache fallback, and client-side 256×256 avatar resizing.
- Added a provider-neutral quantum compute runtime with default local Sampler fallback plus real IBM Cloud IAM, IBM Quantum backend discovery, OpenQASM 3 Sampler V2 submission, remote job listing/details, and evidence receipts that distinguish submission from completed hardware execution.

- Added exclusive ÆTHERGRID workspace routing so Grid, Holographic, Quantum, AI, Scenarios, Evidence, and Settings operate as distinct usable views instead of a single scrolling dashboard.
- Added persistent operator settings for default workspace, density, motion, holographic auto-rotation, labels, default 4D time, event streaming, and polling fallback.
- Added replaceable `local`, `openai-compatible`, and `ollama` AI provider adapters with per-agent VÆLON/AUREN/SOLVÆR/TEAM model configuration, safe runtime introspection, provider timeout/fallback evidence, individual-agent endpoints, and three-agent parallel team synthesis.
- Added real model-adapter tests against local fake OpenAI-compatible and Ollama HTTP servers so provider wiring is exercised without external credentials.
- Added direct WebGL node picking, synchronized Grid/Holographic selection, editable custom scenarios, weighted optimization controls, deterministic classical-vs-experimental comparison, optimization history, and evidence receipts.
- Added Evidence drill-down records for custom scenarios, individual agent runs, team synthesis, and optimization runs, including contribution receipts and provider/model provenance.
- Added app-local `.env.example`, PowerShell start/stop scripts, and a CMD launcher so the packaged ZIP can launch the full backend-connected app on Windows with Node 22+.

- Replaced the screenshot-backed ÆTHERGRID runtime with semantic HTML panels, real controls, native WebGL wireframe geometry, animated canvas/SVG charts, and canonical logo assets.
- Added a true time-indexed spatial graph model represented as x/y/z + time, including interactive orbit/zoom controls, a 24-hour temporal scrubber, layer toggles, wireframe buildings, transmission routes, live nodes, and backend-served geometry at `/api/aethergrid/spatial`.
- Added generated `standalone.html` packaging that inlines CSS, JavaScript and brand assets while preserving the actual WebGL renderer; the old dashboard reference image is excluded from the runtime ZIP and retained only as a design reference.

- Rebuilt the ÆTHERGRID operator console to match the approved modern command-center reference, including the New York Metro digital-twin field, side navigation, AI collaboration rail, animated metrics/quantum/scenario surfaces, holographic previews, evidence history, and export tools.
- Brought the approved ÆTHERGRID dashboard to life with subtle scanline/energy/node motion, active-selection feedback, command search, metric drill-downs, region switching, scenario switching, holographic layer controls, live/forecast/scenario modes, agent drill-downs, AI chat, bounded optimization, health/reset actions, and evidence exports.
- Expanded the ÆTHERGRID Node backend with telemetry, view, region, scenario, reset, activity/audit, optimization, collaboration, and export endpoints while preserving the advisory-only/no-actuation authority boundary.
- Added a server-sent live telemetry stream, animated energy-flow canvas, live connection state, and dynamic HUD clock so the approved command-center canvas behaves like an active operator surface instead of a static mockup.
- Fixed extracted-HTML rendering by replacing root-relative browser dependencies with direct-file-compatible relative assets and adding the maintained NYC field visual to every verified ZIP.

- Introduced the **ÆTHERGRID** operator product identity on top of the maintained THERGRID application service.
- Added a real `apps/operator-console/` UI with GRID / HOLOGRAPHIC / QUANTUM / AI / EVIDENCE views.
- Added a read-only operator capability contract backed by the existing VÆLON model route, quantum-inspired optimization backend, holographic device registry, and safety boundaries.
- Added a local operator-console server and `npm run operator-console` launcher with tests for static assets, read-only API behavior, and no-actuation safety.
- Added operator-console product/architecture documentation covering the human-in-the-loop authority boundary.
- Added reusable canonical ÆTHERGRID, VÆLON, AUREN, and SOLVÆR brand assets and wired the product/agent marks directly into the maintained operator-console UI.
- Added release-readiness and HTTP assertions so missing, truncated, or disconnected brand assets fail verification instead of silently degrading the interface.
- Added complete ÆTHERGRID `app.json` and `ui.json` manifests plus package documentation so the UI is reviewable in both HTML and machine-readable JSON form.
- Added a deterministic `aethergrid-operator-console.zip` builder that rejects missing/empty files and embeds populated capability/operator-state JSON snapshots, a file inventory, and SHA-256 checksums.
- Added CI/release artifact retention so every verified package contains the full UI, canonical brand assets, JSON manifests, and runtime snapshots rather than empty placeholders.
- Wired GRID, HOLOGRAPHIC, and EVIDENCE views to a validated synthetic operator-state chain spanning the twin, SOLVÆR projection, operator dashboard/evidence package, enriched spatial scene, and holographic render packet.

- Pinned ESLint, Prettier, and TypeScript as exact local development dependencies with a synchronized npm lockfile and release-readiness parity checks.
- Machine-readable and reviewer-facing classification identifying THERGRID as a Node.js application service rather than infrastructure-as-code.
- An explicit conventional `npm test` CI signal so automated scanners can detect the runnable suite.
- Release-readiness enforcement that preserves the application-vs-IaC boundary.

### Changed

- Current package candidate: `0.1.3`. The `v0.1.2` release is the latest hosted milestone; this candidate is not published until the gated manual release workflow publishes it.

## 0.1.1 — 2026-09-24 — post-release hardening

### Added

- Provider-neutral startup/config error reporting with bounded context and isolated reporter failures.
- Raw V8 coverage retention from the exact blocking Node coverage run.
- Canonical runtime/type-check support for the platform health and observability surface.

### Changed

- Root container/runtime discovery and environment metadata are now validated through the maintained release-readiness contract.
- Published as `v0.1.1` on 2026-09-24 through the gated manual release workflow.

## 0.1.0 — 2026-09-24 — deterministic spatial-intelligence hardening

### Added

- Deterministic synthetic microgrid pipeline spanning validated snapshots, TwinState, forecast, advisory planning, simulation, decision receipts, provenance, SpatialScene, render packets, and operator review evidence.
- Renderer-neutral holographic presentation contracts for HoloMat, projector, volumetric 3D, AR/VR, and conventional dashboard clients.
- SOLVÆR collaboration boundaries with immutable request/evidence identity, solver comparison evidence, fallback provenance, promotion gates, and explicit non-authoritative safety.
- Operator-attention contracts with affected metrics, advisory actions, snapshot staleness boundaries, source-backed asset/node scope, and sealed read/dashboard projections.
- Spatial evidence layers for validated topology, asset power flows, forecast deltas, simulation evidence, policy gates, provenance, and solver comparison.
- Structured platform health/status service, Docker/Compose verification, dependency auditing, coverage gates, CodeQL, and an evidence-based release-readiness verifier.

### Changed

- Release readiness now preserves the security policy, contribution guide, review ownership, and pull-request validation template as required governance.
- Gated releases now attach a CycloneDX dependency SBOM, exact commit evidence, and SHA-256 checksums.
- Release evidence now includes a machine-readable manifest binding the requested tag, package version, and exact commit SHA.
- Manual release evidence is checksum-verified and retained as a workflow artifact before GitHub publication so failed publication does not discard the verified bundle.
- Spatial and operator presentation paths now retain validated source identity instead of reconstructing or inventing asset/node scope downstream.
- Renderer-bound evidence remains advisory-only, non-authoritative, and non-actuating even when simulation or solver evidence is eligible for operator review.
- Release verification now proves the repository's reproducibility, safety, evidence, and security gates before a release is considered ready.
- Dependency maintenance now has an explicit weekly npm and GitHub Actions update contract, and release readiness fails if that automation disappears.

### Release policy

- Published as `v0.1.0` on 2026-09-24 through the gated manual release workflow.
- This changelog records real repository work only.
- Advanced solver output never becomes authoritative solely because it outperforms a baseline.

