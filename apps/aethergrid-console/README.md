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

The Node backend provides state, optimization, AI collaboration, evidence, and export APIs. The application remains advisory-only and does not expose physical infrastructure actuation.
