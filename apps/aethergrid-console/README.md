# ÆTHERGRID Operator Console

This directory contains the maintained ÆTHERGRID front end and Node backend.

## Runtime architecture

The live interface is no longer a screenshot with hotspots. The application is composed from real HTML controls, semantic panels, SVG/canvas charts, canonical brand assets, and a native WebGL spatial renderer.

The main spatial surface represents **four dimensions as x/y/z space plus time**. Each WebGL vertex carries a temporal phase as its fourth attribute, and the operator can orbit the camera, zoom, toggle wireframe layers, and scrub the time dimension. When the Node backend is running, the renderer loads its nodes, transmission routes, structures, region and scenario context from `GET /api/aethergrid/spatial`.

The old dashboard reference remains a design reference only and is excluded from the distributable runtime ZIP. It is not used as a background image.

## Full app

Run:

```bash
node server.mjs
```

Then open:

```text
http://127.0.0.1:8090
```

The backend provides state, live telemetry, server-sent events, the 4D spatial graph, region switching, review-mode switching, scenarios, bounded optimization, AI collaboration, evidence, exports, reset and health APIs. Physical grid actuation and infrastructure dispatch remain disabled.

## Standalone HTML

Run:

```bash
npm run package:aethergrid-app
```

The generated archive contains `standalone.html`. That file inlines the CSS, JavaScript and canonical logo assets so it can be opened directly with `file://` while retaining the real WebGL grid and local simulation fallback.

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

Settings are real browser-persistent preferences stored under `aethergrid.operator.settings.v2`. They control the default workspace, interface density, animation intensity, reduced-motion mode, holographic auto-rotation, spatial labels, default 4D hour, event-stream use, and polling fallback interval. Provider secrets are never stored in browser settings.

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
