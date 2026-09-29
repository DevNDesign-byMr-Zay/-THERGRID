# ÆTHERGRID Operator Console Package

This directory is the maintained ÆTHERGRID user-interface source packaged from the THERGRID application service.

## Included UI formats

- `index.html` — complete HTML application shell.
- `app.json` — application/package manifest for tooling and archive inspection.
- `ui.json` — machine-readable description of the visible information architecture, navigation, AI identities, and authority boundary.
- `styles.css` — complete responsive dark holographic interface styling.
- `app.js` — complete UI rendering and live/fallback data loading logic.
- `model-logos.js` — canonical VÆLON, AUREN, and SOLVÆR logo mapping.
- `assets/` — ÆTHERGRID and AI-agent brand assets.

The generated ZIP additionally contains populated `capabilities.json`, `operator-state.json`, `PACKAGE_CONTENTS.json`, and `SHA256SUMS.txt` files. They are generated from the maintained application contracts at package time, so the archive has complete JSON runtime content instead of empty placeholders.

## Run from the repository

```bash
npm ci --ignore-scripts
npm run operator-console
```

Then open:

```text
http://127.0.0.1:8090
```

## Build the complete ZIP

```bash
npm run package:aethergrid
```

The output is:

```text
dist/aethergrid-operator-console.zip
```

The packaging task fails if any required UI file is missing or empty. It also verifies the HTML shell, parses both source JSON files, embeds populated runtime snapshots, records file sizes and SHA-256 digests, and produces a deterministic ZIP without relying on an external ZIP utility.

## Static package preview

When the generated ZIP is extracted and served from a basic static web server, `app.js` first attempts the live THERGRID API and then falls back to the packaged `capabilities.json` and `operator-state.json`. This keeps the full UI populated even when the archive is reviewed independently of the application service.

ÆTHERGRID remains advisory-only. The UI does not grant physical grid actuation, infrastructure dispatch, or silent candidate-promotion authority.
