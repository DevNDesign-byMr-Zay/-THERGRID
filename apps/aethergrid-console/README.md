# ÆTHERGRID Operator Console

This directory contains the maintained ÆTHERGRID Node backend and its **canonical React + TypeScript + Cesium command center**.

## Canonical runtime architecture

The primary browser application lives in `web/` and is built by Vite into `web/dist/`. The Node server in `server.mjs` serves that production build at `/`, preserves the same-origin `/api/aethergrid/*` provider contracts and server-sent events, and uses SPA fallback only for non-API browser routes.

CesiumJS is the primary geographic renderer. It now boots in a **credential-free open mode** with a real WGS84 globe, OpenStreetMap raster context and source-backed OSM building extrusions even when no Cesium Ion token is installed. When a Cesium Ion token is configured, World Terrain and Cesium OSM Buildings augment that same scene. The typed native-WebGL adapter remains the last renderer fallback inside the v4 application. The older root `index.html`, `styles.css`, and `app.js` are **legacy compatibility source only**; the full-app ZIP places them under `legacy/` and they are never served as the canonical root.

Provider credentials remain server-side. The browser receives only the bounded public configuration contract, including a restricted public-client Cesium token when configured. IBM Quantum, D-Wave, AI, Tomorrow.io, EIA and other private credentials are not compiled into the Vite bundle.

The approved command-center screenshot is a design/acceptance reference only and is excluded from the runtime package.

## Production launch

From the repository root:

```bash
npm run aethergrid-app
```

That command performs the locked React workspace install/build and then starts the Node server at the configured port (default `http://127.0.0.1:8090`).

For a previously built workspace, the direct server command is:

```bash
node apps/aethergrid-console/server.mjs
```

If `web/dist/index.html` is absent, the production server fails visibly with `canonical_web_build_missing` rather than silently serving the old v3 interface.

## Full application ZIP

Run:

```bash
npm run package:aethergrid-app
```

The packager performs a locked v4 web build and produces `dist/aethergrid-functional-app.zip`. The archive contains the canonical `web/dist/` application, Node backend/provider modules, the required Zod runtime dependency, launchers, manifests, integrity inventory, and the native v3 compatibility surface under `legacy/`.

`legacy/standalone.html` remains available for direct-open native-WebGL/offline compatibility. It is explicitly noncanonical and does not replace the React/Cesium command center.

Physical grid actuation and infrastructure dispatch remain disabled; optimization and agent output remain advisory and evidence-bound.

## Interactive surfaces

- Native WebGL 4D grid with time-indexed geometry.
- Live OpenStreetMap city structures rendered as solid translucent 3D volumes plus wireframe edges, with building-part and minimum-height support.
- Pointer orbit, wheel zoom, double-click camera reset and layer toggles.
- 24-hour temporal scrubber that changes the fourth-dimension phase.
- Backend-generated spatial graph with nodes, routes and structures.
- Live / forecast / scenario modes and region switching.
- Real metric cards with SVG sparklines.
- Animated optimization landscape and scenario comparison canvases.
- Holographic wireframe preview canvases.
- VÆLON, AUREN and SOLVÆR collaboration surfaces plus AI chat.
- Evidence review and JSON export packages.
- Server-sent live telemetry with standalone local fallback.

ÆTHERGRID is an operator-review surface. Simulation and optimization remain advisory and evidence-bound.


## Functional workspaces

The application now routes between distinct Grid, Global, Holographic, Quantum, AI, Scenarios, Evidence, and Settings workspaces. Navigation changes the active workspace instead of scrolling a single long dashboard.

Settings are real browser-persistent preferences stored under `aethergrid.operator.settings.v2`. They control Light / Dark / System appearance, default workspace, interface density, animation intensity, reduced-motion mode, holographic auto-rotation, spatial labels, default 4D hour, event-stream use, and polling fallback interval. Provider secrets are never stored in browser settings.

## AI agent runtime

The Node backend contains a provider-neutral runtime in:

- `agent-config.mjs`
- `ai-runtime.mjs`

Supported adapters:

- `local` — deterministic credential-free fallback;
- `openai-compatible` — real HTTP chat-completions adapter;
- `ollama` — local Ollama chat adapter.

VÆLON, AUREN, SOLVÆR, and the TEAM synthesizer each resolve their provider/model through environment configuration. Every provider failure records fallback metadata instead of silently pretending the requested model ran.

Individual endpoints:

```text
POST /api/aethergrid/agents/V%C3%86LON
POST /api/aethergrid/agents/AUREN
POST /api/aethergrid/agents/SOLV%C3%86R
```

Team endpoint:

```text
POST /api/aethergrid/team
```

The team route runs the three specialist agents in parallel and then passes their contributions into a separately configurable synthesis provider. The local fallback still combines all three contributions when no provider is configured.

`GET /api/aethergrid/runtime` exposes only safe provider/model readiness metadata; API keys are never returned.

## v2.5 city operations and agent workspaces

The GLOBAL workspace now turns mapped city geometry into a usable planning surface rather than a generic wireframe preview:

- cinematic globe-to-city descent followed by a local 3D fly-in;
- solid, X-ray and operations visual modes;
- live OSM building footprints, building parts, minimum heights, roads, mapped power infrastructure and elevation;
- bounded city-operation workflows for grid resilience, outage impact, emergency access, renewable siting and load growth;
- planning indicators recorded into evidence and shared with the AI runtime as advisory context;
- independent persistent chat threads for TEAM, VÆLON, AUREN and SOLVÆR, with bounded conversation history sent to the configured model provider.

City-operation scores are planning proxies derived from the currently loaded bounded map sample. They are not utility ground truth, outage forecasts, emergency routing guarantees, resource assessments or dispatch authority.
## v2.6 source-backed city fidelity and current context

Preset cities now target recognizable skyline districts instead of generic metropolitan centroids: Midtown Manhattan, City of London / South Bank, Shinjuku, Downtown Dubai, Marina Bay / Downtown Core, Paulista / Bela Vista, Victoria Island / Eko Atlantic, and Sydney CBD / Circular Quay.

Each backend-connected city twin is assembled from current open-data requests and preserves source provenance rather than fabricating missing landmarks:

- OpenStreetMap Overpass footprints, building parts and relation outer geometry;
- source `height`, `est_height`, `building:levels`, `min_height` and `building:min_level` metadata;
- source roof shape / roof height / roof levels and building/roof material or colour metadata when present;
- mapped roads and energy infrastructure;
- bounded Open-Meteo / Copernicus terrain elevation;
- current Open-Meteo temperature, cloud, precipitation, daylight and wind context;
- the OpenStreetMap upstream timestamp and city height-data coverage shown in the GLOBAL provenance/readout.

The renderer keeps source-backed tall structures up to 1,200 m, preserves high-value/tall structures before spatial sampling dense scenes, builds supported roof forms, and derives each city's opening camera from that city's actual footprint distribution and skyline height. The 4D time control snaps to the city's current local model time when live environment data is available; **LIVE NOW** returns to that state after scrubbing.

This is a source-backed digital-twin representation, not photogrammetry. Where open map data lacks a height, roof, façade or building part, ÆTHERGRID exposes the coverage gap and does not claim architectural identity it cannot verify.

Settings now include **Dark**, **Light**, and **System** appearance modes. The selected mode persists locally and changes the semantic UI plus WebGL scene palette.
## v2.7 live city animation and operational context

The GLOBAL workspace now animates current source context instead of applying the same ambient motion to every city.

At planetary scale:
- a secondary WebGL atmosphere shell pulses independently from the latitude/longitude grid;
- a UTC sweep moves around the globe as a real clock reference;
- maintained city nodes pulse by their current modeled US AQI when available;
- recent USGS M2.5+ earthquake events appear as magnitude-tiered pulses;
- the WORLD NODES list exposes current AQI alongside each configured city when the feed is available.

After descending into a city:
- current wind speed/direction generates animated 3D wind vectors;
- current precipitation generates wind-leaning rain streaks;
- modeled US AQI controls an independent atmospheric particle field;
- recent nearby USGS events produce directional pulsing rings;
- WEATHER, AIR and SEISMIC are independent layers and can be disabled without hiding the underlying city twin.

The existing city-operation workflows now consume the same bounded live context where it is relevant. Three dedicated workflows are also available: **Weather Readiness**, **Air Quality Exposure**, and **Seismic Awareness**. Each workflow chooses its own renderer layer profile and animation emphasis and writes the live-source provenance into the evidence-bound result.

The live-data boundary remains explicit. Open-Meteo current weather and air quality are model products at the requested coordinate, not block-level physical sensors. USGS event data is situational earthquake context, not a structural-damage estimate, aftershock forecast or emergency directive. If a provider is unavailable, the related visualization is labeled fallback/unavailable instead of being fabricated.

Configuration:

```text
AETHERGRID_AIR_QUALITY_PROVIDER=open-meteo
AETHERGRID_AIR_QUALITY_URL=https://air-quality-api.open-meteo.com/v1/air-quality
AETHERGRID_SEISMIC_PROVIDER=usgs
AETHERGRID_USGS_EARTHQUAKE_URL=https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson
AETHERGRID_SEISMIC_CACHE_TTL_MS=60000
```
## v2.8 solar city identity and atmospheric motion

v2.8 deepens the visual identity of each loaded city by binding the scene to current solar, atmospheric, and mapped-building context rather than applying one generic animation profile.

Planetary behavior:
- computes the current subsolar latitude/longitude from UTC using solar declination and equation-of-time approximations;
- renders the resulting day/night terminator as live native-WebGL geometry;
- renders the subsolar point and highlights maintained cities currently on the night side;
- keeps the existing UTC sweep, AQI pulses, seismic pulses, and cinematic city descent.

City behavior:
- current Open-Meteo cloud cover generates a wind-driven cloud deck above the mapped skyline;
- wind vectors and precipitation now move directionally through shader flow uniforms instead of only pulsing in place;
- precipitation receives a downward fall term while retaining current wind direction;
- procedural skyline light points are generated from actual mapped building geometry and become prominent on the current night side;
- city-light points are explicitly a visualization device, not a claim about occupied windows, utility load, or measured lighting.

Current environment context now also includes modeled relative humidity, surface pressure, sunrise, sunset, daylight duration, and sunshine duration. These fields remain source-timestamped and server-side provider driven.

Two additional bounded operations are available:
- **Heat Stress** — combines apparent temperature, humidity, UV, and mapped built-form density as an attention proxy;
- **Visibility Operations** — combines current visibility, precipitation, cloud, AQI, and mapped roads/structures for situational review.

Both operations remain advisory-only. Heat Stress is not WBGT or a clinical risk calculation, and Visibility Operations is not a traffic, aviation, marine, or emergency-clearance authority.
## v2.9 source-backed city identity and semantic weather

City twins now expose a source-backed identity layer instead of relying on skyline shape alone.

For each loaded OpenStreetMap building sample, ÆTHERGRID derives:
- named mapped structures, sorted by source-backed modeled height;
- tall-structure count using the current sample's P95 skyline height with an 80 m floor;
- max / P95 / median height, roof-tag coverage, building-part count and height-data coverage;
- interactive LANDMARKS geometry that highlights named/tall structures without inventing missing landmark identity;
- a CITY IDENTITY inspector that lets the operator select those source-backed anchors in the 3D scene.

Weather rendering is now semantic rather than generic:
- rain uses wind-drifted falling streaks;
- modeled snow codes generate slower drifting snow particles;
- fog codes or low modeled visibility generate a low-altitude fog field;
- modeled thunderstorm codes add a bounded lightning-style pulse while rain continues independently.

The thunderstorm pulse is **not** a detected lightning strike. Rain, snow and fog effects visualize current provider model context and are not street-level weather instrumentation.
## v2.9.1 geographic city identity

v2.9.1 reconciles the source-backed CITY IDENTITY / semantic-weather work already on `main` with additional mapped geography, so each city can differ through both its skyline and its surrounding physical context.

When returned by the live OpenStreetMap sample, the city twin now adds:
- water polygons from mapped `natural=water` / water-type tags;
- rivers, canals, streams and tidal channels;
- mapped coastline segments;
- parks, gardens, reserves, recreation/grass/meadow areas, woods and grassland;
- restrained façade tint groups when building material/colour tags exist.

These layers coexist with the existing named/tall skyline anchors and semantic rain, snow, fog and thunderstorm rendering. WATER and GREEN are independently toggleable, while LANDMARKS continues to use the stronger source-backed identity-anchor path already established on `main`.

Fallback behavior is deliberately conservative: local fallback geometry does **not** invent water, coastline, parks or green space. Missing mapped geography remains empty/unknown.

The operation catalog expands to 12 with **Flood Context** and **Green Infrastructure**. Both are bounded planning-context proxies: Flood Context is not inundation/storm-surge/drainage forecasting, and Green Infrastructure is not measured canopy, heat exposure, public-health risk or a siting directive.
## v3.0 terrain-conforming city geometry

The city twin now uses the bounded elevation grid as a vertical reference instead of drawing mapped city geometry on one flat local plane.

Terrain fitting behavior:
- the browser performs bilinear interpolation across the same local-meter DEM grid returned by `terrain-runtime.mjs`;
- building foundations remain flat but are anchored to the interpolated elevation at each footprint center;
- roads and mapped waterways drape vertex-by-vertex over the interpolated terrain surface;
- green-space polygons drape across the DEM while preserving their mapped horizontal geometry;
- mapped power lines and asset markers inherit local terrain elevation plus their presentation clearance/height;
- coastline uses the bounded terrain datum to avoid climbing inland slopes;
- mapped water polygons remain level presentation planes using the lowest interpolated polygon-edge elevation rather than being warped over terrain.

The GLOBAL stats, CITY IDENTITY panel and provenance surface label this as **DEM DRAPED** when live elevation is available and **FLAT FALLBACK** otherwise.

This is visualization-grade terrain fitting. The default live source is Open-Meteo Elevation backed by Copernicus DEM GLO-90; it is not survey, engineering, cadastral or LiDAR-grade vertical positioning. The app does not infer foundation engineering, road grade compliance, water level, drainage or clearance authority from the DEM.
## Canonical v4 spatial application

The canonical ÆTHERGRID product surface lives under `apps/aethergrid-console/web/`. It is the typed React/Cesium application served by the maintained Node backend, packaged as `dist/aethergrid-functional-app.zip`, and promoted as the primary user-facing experience. The earlier native v3 surface remains only under `legacy/` for direct-open compatibility and historical review.
Implemented v4 behavior includes:
- Cesium as the primary geographic renderer with continuous WGS84 globe → region → city → district camera travel;
- a real source-backed native WebGL fallback that consumes the same normalized overlays, 4D time, layer state, selection state and scenario context when Cesium cannot initialize;
- safe manual CESIUM / NATIVE switching with reversible failover and visible failure diagnostics;
- streamed terrain and 3D-building detail that increases progressively as the camera approaches city/district scale;
- computed solar elevation/azimuth tied to the 4D clock, with solar-aware atmosphere and restrained building presentation;
- a continuously advancing LIVE clock plus independent historical, forecast and scenario cursors;
- explicit temporal source gating: AQI and seismic remain current-only outside LIVE, while weather may render in FORECAST only when the active 4D cursor aligns to a returned provider forecast sample; historical/scenario weather is never invented;
- source-driven cloud, rain, snow, fog, AQI and thunderstorm presentation, with thunderstorm flash timing explicitly labeled synthetic rather than observed lightning;
- live wind vectors generated from provider wind speed/direction/gusts as normalized geographic overlay geometry shared by Cesium and native failover;
- mapped-building nighttime illumination points derived from real building footprints/heights and capped for performance; these are presentation-only and do not represent measured occupancy, window state or utility load;
- source-backed roads, water, green space, power topology, recent seismic context and selectable entity provenance;
- live NWS active-hazard context with severity-coded alert markers and provider-returned Polygon/MultiPolygon boundary geometry; when NWS omits geometry, only a point-context marker is shown and no affected-area shape is invented;
- scenario-mode network visualization aligned with the backend scenario stress factors, including a dim source-baseline comparison beneath the modeled scenario presentation;
- operational view presets using only implemented layers: City Ops, Grid Resilience, Environment, Seismic and Skyline;
- explicit per-city/coordinate source bindings for NOAA NWPS gauge IDs and EIA balancing-region codes, persisted locally as non-secret operator settings and never inferred from map location;
- browser-persistent saved spatial views that restore scope, target, layers, visual mode, operation mode and the 4D cursor without silently re-submitting backend scenarios;
- selected-entity provenance handoff into AUREN, prefilled for operator review but never auto-submitted;
- independent city-load readiness for geometry, atmosphere and live context;
- renderer-neutral INSPECT / MEASURE interaction with geographic surface picking in Cesium and explicitly labeled projection estimates in native fallback;
- operator geodesic measurement for distance, bearing and optional elevation delta/slope, with the measurement tied to its captured 4D frame rather than drifting with LIVE time;
- Frame A / Frame B spatial comparison across cities or times using only metrics available in both captures;
- non-authoritative local comparison export plus operator-controlled AUREN review that is explicitly separate from the server evidence ledger.
Fidelity boundaries remain explicit. OpenStreetMap / terrain / Open-Meteo / air-quality / USGS data retain their source status and timestamps. Synthetic presentation effects never become authoritative observations. Scenario styling never mutates source data. Native failover preserves the operator-review surface but is not claimed to provide the same photorealistic detail as the Cesium path. Physical infrastructure actuation remains disabled.

The draft v4 operator lane also consumes the merged provider foundation for a safe provider Connection Center, normalized Tomorrow forecast samples, source-backed NWS alert geometry, decoded GTFS-Realtime vehicle positions, explicitly bound NOAA NWPS gauge geometry, EIA fuel-mix records, and a manually confirmed D-Wave annealing workflow. GTFS route lines are not inferred, NOAA gauge locations are not guessed, EIA regions are not converted into invented polygons, and D-Wave hardware execution is not claimed until the provider returns a completed answer.
## Windows ZIP workflow

After extracting the package:

1. Double-click `START-AETHERGRID.cmd`, or run `./START-AETHERGRID.ps1`.
2. The launcher verifies Node.js 22+, starts the backend and opens the local app.
3. Run `./STOP-AETHERGRID.ps1` when finished.
4. To configure real model providers, copy `.env.example` to `.env` and fill in the provider/model settings. Never commit the populated `.env`.

The generated `standalone.html` remains available for direct-open WebGL/local-fallback use when no Node backend is desired.

## Global God's-eye workspace

ÆTHERGRID now includes a native-WebGL global workspace. The globe is generated from real latitude/longitude coordinates rather than a map screenshot. The maintained city registry currently includes New York, London, Tokyo, Dubai, Singapore, São Paulo, Lagos, and Sydney.

Selecting **DESCEND INTO CITY** requests building footprints from the configured OpenStreetMap Overpass provider. Returned building ways are projected from geographic coordinates into a local metric frame, assigned height from OpenStreetMap `height` / `building:levels` tags when present, and rendered as interactive 3D wireframe extrusions. The request is operator-triggered and cached; it is not an autocomplete, bulk scraper, or background crawler.

When the live provider cannot be reached, the UI labels the geometry as local fallback rather than presenting it as live map data. OpenStreetMap attribution remains visible whenever OSM-derived geometry is used.

## Persistent operator profile

The top-right profile is now editable and persistent. The local Node backend stores bounded profile data in `.aethergrid-data/operator-profile.json` with private file permissions. The browser keeps a cache so the profile remains visible in direct-open/standalone mode.

Supported fields:
- display name and initials;
- title and organization;
- home region and timezone;
- short bio;
- avatar upload.

Avatar files are resized in-browser to 256×256 before persistence and are limited by the server-side encoded-size guard. This profile is local application identity, not an Internet authentication or authorization system.

## Quantum compute runtime

The Quantum workspace now has two execution providers:

- `local-simulator`: credential-free deterministic sampler used by default and in offline ZIP workflows;
- `ibm-quantum`: real IBM Quantum Compute Service REST integration.

The IBM adapter uses server-side IBM Cloud IAM authentication, backend discovery, Sampler V2 job submission, remote job listing, and job-detail retrieval. The current maintained IBM API version is `2026-04-15`.

To enable IBM Quantum, configure in the app-local `.env`:

```text
AETHERGRID_QUANTUM_PROVIDER=ibm-quantum
AETHERGRID_IBM_QUANTUM_API_KEY=<server-side secret>
AETHERGRID_IBM_QUANTUM_SERVICE_CRN=<instance CRN>
AETHERGRID_IBM_QUANTUM_BACKEND=<backend name>
```

The browser never receives the API key or IAM bearer token. Submitting a job is not treated as proof that QPU execution completed; the evidence record distinguishes submission from completed hardware execution.

## Global grid intelligence v2

The GLOBAL workspace now goes beyond preset city descent.

Operators can enter any valid latitude/longitude pair and request an on-demand local spatial mesh around that coordinate. In backend-connected mode, the geospatial runtime asks the configured OpenStreetMap Overpass endpoint for:

- building footprints and available height/level metadata;
- roads/highways;
- mapped power lines, minor lines, and cables;
- mapped substations, plants, generators, and transformers.

Each source category remains an independent WebGL layer. Buildings, roads, the power grid, and asset nodes can be toggled without replacing the scene with a raster map. The city renderer also has its own time index so the same x/y/z geometry can be reviewed as a 4D presentation surface.

The custom coordinate route is:

```text
GET /api/aethergrid/geospatial/point?lat=<latitude>&lon=<longitude>&radiusM=<250-2000>&name=<label>
```

OpenStreetMap data remains attribution-bound and operator-triggered. If the live provider is unavailable, the app shows deterministic local fallback geometry and labels it as fallback.

## Agent external context

VÆLON, AUREN, SOLVÆR, and TEAM requests now receive a bounded external-context summary containing the most recently loaded geospatial scene and quantum job state. The AI runtime receives counts, provider identity, coordinate/region context, job identity/status, and evidence receipts—not provider secrets or unrestricted infrastructure authority.

This means an agent can reason about what the operator actually loaded in GLOBAL or QUANTUM without silently controlling those systems. Physical actuation remains disabled.

## Terrain and elevation layer

The GLOBAL city renderer now supports a real terrain layer in addition to buildings, roads and mapped power infrastructure.

Backend-connected mode uses the provider-neutral `terrain-runtime.mjs`. The default live adapter samples elevation through Open-Meteo's Elevation API, which exposes Copernicus DEM GLO-90 elevation data. Sampling is bounded to a small 3×3 through 9×9 grid around the operator-selected coordinate. The resulting elevation points are projected into the same local metric frame as the city geometry and rendered as native WebGL terrain wireframes.

The terrain layer can be toggled independently with **TERRAIN**. It does not replace the city with a raster or screenshot.

Configuration:

```text
AETHERGRID_TERRAIN_PROVIDER=open-meteo
AETHERGRID_ELEVATION_URL=https://api.open-meteo.com/v1/elevation
AETHERGRID_OPEN_METEO_API_KEY=
```

When the live elevation provider is unavailable, the renderer uses a clearly labeled flat local fallback. Terrain source attribution is shown alongside OpenStreetMap attribution. Terrain summaries may be passed to the AI team as bounded context, but no terrain or AI path grants physical actuation authority.


## ÆTHERGRID v4.0 Production Provider Foundation (Batch 18)
Batch 18 establishes the production backend provider, configuration, secret-safety, and runtime foundation for ÆTHERGRID v4.0.
### Features
- **Centralized Environment Schema ()**: Schema-validated environment config powered by Zod.
- **Secret Redaction ()**: Strips configured API keys, bearer tokens, and CRN strings from logs, runtime outputs, errors, and exports.
- **Outbound URL Safety Policy ()**: Restricts server-side outbound HTTP calls to validated provider endpoints and safe local developer services (e.g. local Ollama).
- **Provider Registry ()**: Wraps existing runtimes (spatial, geo, weather, air quality, seismic, terrain, quantum, AI, energy, transit, hydrology) and exposes normalized status (, , , , ).
- **Resilience Primitives**: In-memory cache (), circuit breaker (), and per-provider rate limiter ().
- **Public Runtime Endpoint**:  provides safe, secret-redacted provider readiness metadata.