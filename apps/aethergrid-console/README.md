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
- Interactive wireframe city structures and transmission routes.
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

The application now routes between distinct Grid, Holographic, Quantum, AI, Scenarios, Evidence, and Settings workspaces. Navigation changes the active workspace instead of scrolling a single long dashboard.

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

## Windows ZIP workflow

After extracting the package:

1. Double-click `START-AETHERGRID.cmd`, or run `./START-AETHERGRID.ps1`.
2. The launcher verifies Node.js 22+, starts the backend and opens the local app.
3. Run `./STOP-AETHERGRID.ps1` when finished.
4. To configure real model providers, copy `.env.example` to `.env` and fill in the provider/model settings. Never commit the populated `.env`.

The generated `standalone.html` remains available for direct-open WebGL/local-fallback use when no Node backend is desired.
