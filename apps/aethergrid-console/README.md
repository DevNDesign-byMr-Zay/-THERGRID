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
