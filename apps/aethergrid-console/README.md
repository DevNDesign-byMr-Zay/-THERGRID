# ÆTHERGRID Operator Console

This directory contains the complete front end and back end for the approved ÆTHERGRID dashboard.

## Standalone HTML

Open `index.html` directly. It is now a **single self-contained file**: the approved dashboard canvas, CSS, and JavaScript are embedded inside the HTML itself. No sibling asset folder, stylesheet, script file, localhost server, or network connection is required for the visual UI to render when opened with the `file://` protocol.

The modular `styles.css`, `app.js`, and dashboard reference asset remain in the app package as maintained source files and for backend/PWA development, but `index.html` no longer depends on them to render.

## Full app
Run:

```bash
node server.mjs
```

Then open `http://127.0.0.1:8090`.

The Node backend now provides live telemetry, state, region switching, review-mode switching, scenario selection, bounded optimization, AI collaboration, evidence, export, reset, and health APIs. The application remains advisory-only and does not expose physical infrastructure actuation.

## Interactive surfaces

The approved dashboard remains the visual baseline, but the interface now has a real interaction layer:

- top GRID / HOLOGRAPHIC / QUANTUM / AI / EVIDENCE modes;
- left navigation for Overview, Grid, Holographic, Quantum, AI, Scenarios, Evidence, and Settings;
- live / forecast / scenario review modes;
- command search across assets, storage, renewables, and scenarios;
- region switching for New York Metro, Long Island, Hudson Valley, and Upstate New York;
- clickable system-metric cards with animated drill-down telemetry;
- holographic layer controls for infrastructure, energy flow, risk zones, and future state;
- VÆLON, AUREN, and SOLVÆR collaboration surfaces plus AI team chat;
- bounded optimization with classical-baseline preservation;
- evidence review and JSON export packages;
- health-check and reset controls;
- subtle scanline, node-pulse, energy-sheen, active-selection animation, and a live canvas energy-flow layer that preserves the approved idle composition;
- a dynamic HUD clock and connection indicator;
- server-sent live telemetry streaming when the Node backend is running, with polling/standalone fallback behavior.

When opened directly from disk, the self-contained HTML uses local fallback state so the controls still work. When served through `server.mjs`, the same controls are backed by the Node APIs and a short in-memory audit/activity log.
