# ÆTHERGRID Operator Console

This directory contains the complete front end and back end for the approved ÆTHERGRID dashboard.

## Standalone HTML
Open `index.html` directly. The idle canvas is built from the approved 1536×1024 reference dashboard so the initial UI remains visually identical when opened from disk. Relative assets and local JavaScript keep the standalone experience intact.

## Full app
Run:

```bash
node server.mjs
```

Then open `http://127.0.0.1:8090`.

The Node backend provides state, optimization, AI collaboration, evidence, and export APIs. The application remains advisory-only and does not expose physical infrastructure actuation.
