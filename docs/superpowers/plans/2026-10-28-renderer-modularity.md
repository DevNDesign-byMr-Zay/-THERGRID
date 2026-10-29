# ÆTHERGRID Renderer Modularity Continuation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the known palette and oversized-file score-recovery follow-up after merged PR #209.

**Architecture:** Keep Cesium and native WebGL implementations independent while moving their existing color decisions into pure palette modules. Move stable city configuration/search and stateless live-source badges out of the React application shell, leaving asynchronous state ownership in `App.tsx`.

**Tech Stack:** React 19, TypeScript, Cesium, Playwright's Node test runner, Node.js 22, Vite 8.

**Spec:** `docs/superpowers/specs/2026-10-28-renderer-modularity-design.md`

## Global Constraints

- No behavior or color revisions: this is a refactor, not a rebrand or visual redesign.
- Preserve exact provider/source status, data freshness and operator advisory semantics.
- No new credentials, external-provider calls, production deployment, force push, or direct `main` edits.
- Existing root test, typecheck, format, security and browser gates remain unchanged.
- External baseline remains 60/C until an actual independent rescore.

## Review Focus

1. Missing or malformed color values must not produce plausible-but-wrong render colors; test known hex and alpha behavior.
2. Native and Cesium visual-mode tints must not accidentally flatten distinct modes; test one observable output per mode and solar phase.
3. Search must reject out-of-range coordinates and preserve named-city matching; test both valid and invalid inputs.
4. Live source badges must never label fallback or missing data as live; test representative provider states and errors.
5. React JSX extraction must retain viewport layout and accessibility semantics; run existing command-center/browsers when available.

---

### Task 1: Renderer palette decisions

**Files:** Create `apps/aethergrid-console/web/src/renderer/native/native-palette.ts`, `apps/aethergrid-console/web/src/renderer/cesium/visual-mode-palette.ts`; modify `native-webgl-renderer.ts` and `visual-mode-controller.ts`; test `apps/aethergrid-console/web/tests/renderer-palette.spec.ts`.

**Interfaces:** Native module exports `Rgba`, `rgba`, `css`, `mix`, `hazardHex`, `hydrologyHex`, `layerColor`, `visualColor(base, mode)` as pure functions. Cesium module exports pure `tileModePalette(mode, opacity)` and `solarTilePalette(phase, opacity, mappedColor)` descriptors. Consumers retain existing rendering and lifecycle control.

- [ ] Write literal-output tests for alpha conversion, interpolation, severity, layer and visual-mode colors, Cesium mode and solar palettes.
- [ ] Run tests RED for missing pure modules/functions.
- [ ] Extract existing rules verbatim and replace inline decisions with calls; preserve original CSS and shader behavior.
- [ ] Run focused tests GREEN, web typecheck/build and existing spatial presentation tests.
- [ ] Commit the bounded change.

### Task 2: City configuration and search

**Files:** Create `apps/aethergrid-console/web/src/app/city-targets.ts`; modify `apps/aethergrid-console/web/src/app/App.tsx`; test `apps/aethergrid-console/web/tests/city-targets.spec.ts`.

**Interfaces:** Export `CityTarget`, `CITY_TARGETS`, `INITIAL_LAYERS`, `VISUAL_MODES`, and `resolveCityTarget(query)` returning `CityTarget | null`. `App` retains state transitions and empty-query UI behavior.

- [ ] Write tests for existing city targets, case-insensitive partial names/districts, parsed coordinates, ranges, malformed strings and empty input.
- [ ] Run tests RED because the module/export is absent.
- [ ] Extract static data and pure search resolution with unchanged coordinates, defaults and error handling.
- [ ] Run focused tests GREEN, web typecheck/build and command-center acceptance where browser availability permits.
- [ ] Commit the bounded change.

### Task 3: Stateless live scene status badges

**Files:** Create `apps/aethergrid-console/web/src/components/LiveSceneBadges.tsx`; modify `apps/aethergrid-console/web/src/app/App.tsx`; test `apps/aethergrid-console/web/tests/live-scene-badges.spec.ts`.

**Interfaces:** A typed React component accepts current city/scope/time, streaming count and error, city load state, NWS/GTFS/NWPS context/error and displays the same source-status markup. `App` continues owning network requests and state.

- [ ] Write server-rendered component tests for unavailable/live/stale/partial/unconfigured labels and city-stream/load visibility.
- [ ] Run tests RED because the component is absent.
- [ ] Move only stateless JSX; preserve the same class, data attributes and conditional visibility.
- [ ] Run focused tests GREEN, web build/typecheck and existing browser acceptance if available.
- [ ] Commit the bounded change.

### Task 4: Verification and rescore handoff

**Files:** Update `docs/RESCORE_READINESS.md` with this branch's exact evidence and limitations.

- [ ] Run full Node 22 `npm test`, `npm run test:offline`, coverage, syntax, lint, typechecks, format check, web build, and web npm audit.
- [ ] Run available Playwright browser suites, document unavailable browser or Opera connection rather than implying a pass.
- [ ] Review the diff for changed contracts, color literals and security boundaries; record before/after file sizes and HEAD SHA.
- [ ] Commit evidence and prepare a reviewable GitHub PR only after all available checks pass.
