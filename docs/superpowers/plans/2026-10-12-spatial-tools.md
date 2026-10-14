# Spatial tools and modeled comparisons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make presentation, layer opacity, selection, measurements, saved views and scene exports act on the existing interactive spatial workspace.

**Architecture:** Extend the current adapter and overlay layers, keeping one mounted renderer. The temporal clock owns bounded operator-modeled replay independently of source-sample transport. Comparison panels use immutable captured receipts and explicit reduced frame-switching presentation; no current world impersonates historical reconstruction.

**Tech Stack:** Existing React/TypeScript/Cesium/native WebGL and Playwright; no new product dependencies.

**Spec:** `docs/superpowers/specs/2026-10-11-canonical-spatial-experience-design.md`, PR 4 and operational-dashboard sections.

## Global Constraints

- Backend provider adapters, authentication services and release packaging remain outside this frontend workstream.
- D-Wave stays on hold, unconfigured and non-executable.
- No UI control advertises an effect the active renderer cannot implement.
- Measurements identify coordinate system, units and terrain/geodesic approximation limits.
- Scenario effects are operator-created or returned by the authorized backend, always modeled.
- Exclude tokens, account secrets and unintended personal profile fields.
- EIA is regional fuel mix and cannot become verified per-building flow or building consumption.
- Missing authenticated-session and persisted-history contracts remain explicit unfinished dependencies.

## Review Focus

- Replacing or hiding a selected source must clear/revalidate its highlight; task 1 tests selection replacement and opacity zero.
- Presentation switches must preserve mapped footprint/roof identity and release replaced primitives; task 1 tests mode cycles and destruction.
- Restored forecast windows outside new coverage must remain unavailable, without silent clamping; task 2 tests deferred range validation and expired samples.
- Malformed or oversized measurement polygons must not yield plausible area results; task 3 tests self-intersection, non-finite coordinates, antimeridian and extent limits.
- Exported scenes and comparisons must preserve source state and omit secrets; task 4 tests explicit serialization and forecast/stale receipts.

---

### Task 1: Actual presentations, opacity and selection

**Files:** `src/renderer/spatial-renderer.ts`, `src/renderer/cesium/{cesium-renderer,network-overlay-layer,visual-mode-controller,geodetic-grid-layer}.ts`, `src/renderer/native/native-webgl-renderer.ts`, `src/app/App.tsx`, `src/app/command-center.css`; create `tests/spatial-presentations.spec.ts` (paths relative to web).

**Interfaces:** Extend `VisualMode` with `wireframe` and `grid`. Add `NetworkOverlayLayer.setPresentation(mode: VisualMode, opacity: number): void`; preserve existing selection API. Add `GeodeticGridLayer.setOpacity(opacity: number): void`, bounded0–1. App exposes per-layer opacity only for overlays/grid whose active adapter implements it. Native remains explicitly projected wireframe fallback; unsupported solid/reality fidelity stays accurately described.

- [ ] Write failing tests: mapped 40m body/pyramidal roof has actual batched edges; wireframe hides fill and retains pick IDs; holographic changes source primitive alpha; opacity 0 hides all corresponding geometry; selected source gets white edge highlight; replacement clears obsolete selection; repeated presentation switches do not grow primitive count; owning/non-owning teardown destroys resources once.
- [ ] Run focused tests and record expected failures before implementation.
- [ ] Use shared `buildingEdges` for Cesium source outlines, batched geometry, source-preserving pick IDs and independent opacity. Forward presentation to existing/new overlays and implement native alpha modulation. Add functional accessible mode and opacity controls, retaining visibility.
- [ ] Run tests, TypeScript build and compiled mode/layer/picking smoke on Cesium and native; inspect actual captures; commit passing source/tests.

### Task 2: Bounded modeled replay and saved windows

**Files:** `src/time/{temporal-clock,temporal-model}.ts`, `src/services/view-bookmarks.ts`, `src/components/TemporalRail.tsx`, `src/app/App.tsx`; create `tests/modeled-replay.spec.ts`.

**Interfaces:** Add `clock.setModeledRange(startIso: string, endIso: string): void` for SCENARIO only. Continuous modeled cursor is bounded by the active operator scenario's explicit start/end; missing/invalid/zero-duration ranges cannot play. Add optional `playbackRange` to `SpatialViewBookmark`. Restored forecast windows are validated only against newly returned coverage; unavailable endpoints remain unavailable and replay disabled.

- [ ] Write failing tests: 12:00–13:00 operator scenario at 3600× advances to modeled 12:30 after 500ms, pauses/resumes without losing phase, stops exactly13:00; missing end, reversed range or foreign scenario cannot replay; changing scenario/coverage/mode cancels transport. Source forecasts still emit only exact samples. Bookmark copies preserve window without aliasing and legacy cursor-only entries remain accepted.
- [ ] Run intended RED; implement distinct modeled-range transport and rail labeling, range-aware bookmark/session restore. Current-only overlays remain hidden outside LIVE; modeled context retains non-authoritative receipts.
- [ ] Run clock/source/bookmark suites and compiled scenario activation/replay/window restore, build; commit.

### Task 3: Honest area measurement and inspection

**Files:** `src/services/spatial-analysis.ts`, create `src/services/spatial-area.ts`; `src/components/{SpatialAnalysisPanel,EntityDossierPanel}.tsx`, `src/components/SpatialViewport.tsx`, `src/app/App.tsx`, renderer interaction type; create `tests/spatial-area.spec.ts`.

**Interfaces:** Extend interaction mode with `measure-area`. `measureSpatialArea(points: readonly SpatialSurfacePoint[]): SpatialAreaMeasurement | null` returns `areaSquareMeters: number`, `perimeterMeters: number`, copied `points: readonly SpatialSurfacePoint[]` and `approximation: 'local-tangent-plane'`; fewer than3 distinct vertices, invalid coordinates, self-intersection or >20km radius return null. `spatialAreaToOverlay(area: SpatialAreaMeasurement, time: TemporalInstant): SpatialOverlaySnapshot` provides the finished analytical polygon with non-authoritative properties. Never claim terrain surface area. Finish/clear controls distinguish an open measurement from a completed polygon. Inspector displays mapped height category, roof refinement/limitation and source/fetch state already carried in entity properties.

- [ ] Write failing tests: small 100m square gives approximately10000m² and400m perimeter; closed/open ring equivalent; antimeridian small ring remains bounded; invalid/non-finite/self-crossing/>20km input unavailable; copied points cannot mutate completed result.
- [ ] Verify RED, implement bounded local approximation and functional picked polygon overlay/finish/reset controls with units and limitations. Preserve existing two-point distance workflow and projected fallback disclosure.
- [ ] Run measurement/unit and compiled picking/area/inspection acceptance on desktop/mobile; build; commit.

### Task 4: Reproducible scene export and receipt comparisons

**Files:** create `src/services/spatial-scene.ts`; renderer adapter/manager camera snapshot interface; `src/services/spatial-comparison.ts`, `src/components/SpatialComparisonPanel.tsx`, `src/app/App.tsx`; create `tests/spatial-scene.spec.ts`, `tests/spatial-tools-browser.spec.ts`; workflow, acceptance document/captures.

**Interfaces:** Renderer `cameraSnapshot(): SpatialCameraSnapshot | null` returns `projection: 'geocentric' | 'local-projected'`, `latitude`, `longitude`, `heightMeters`, `headingDegrees`, `pitchDegrees`, `rollDegrees` as numbers and optional `target: SpatialTarget`; unsupported bridge returns null. Manager forwards the active adapter snapshot. `buildSpatialSceneDescription(input: SpatialSceneInput): SpatialSceneDescription` consumes typed target/camera/visualMode/layers/temporal/selection reference/dataset receipts/scenario model and exports schema `aethergrid.spatial-scene.v1`, non-authoritative target/camera/presentation/layers/frame/range/selection IDs/source receipts/modeled effects/limitations. No generic spread of profile/config/selection properties. Forecast comparison captures retain weather only when aligned and source-backed, with FORECAST/STALE receipts; historical/scenario observed metrics remain null. Panel provides distinct A/B timestamps, source states, numeric values and explicit reduced frame switching; switching revalidates sources and never silently clamps cursor.

- [ ] Write failing tests: export retains selected source ID, actual camera, opacity and range; nested input mutation does not alter payload; sentinel secrets/profile fields absent; unsupported camera explicit null; aligned forecast weather captured as forecast/stale, gaps/current-only history absent; A/B same metric across incompatible source states is labeled rather than presented as verified measured change.
- [ ] Verify RED, implement explicit export serializer/download and comparison receipts/frame-switching controls. Add compiled download parsing and keyboard/selection/presentation/range coverage. Verify mobile native notice/time rail clearance; retain any unresolved final polish explicitly.
- [ ] Run TypeScript build, root Engineering checks, all applicable browser suites serially, screenshot inspection and independent whole-branch review. Fix Important/Critical findings once via RED→GREEN, record minors/rulings. Publish PR4 stacked on timeline only after exact-head Engineering CI, CodeQL and browser acceptance; no merge/release.

## Plan boundaries

This plan uses local operator scenario geometry already present in the repository; it does not duplicate backend optimization decisions. Comparison uses the explicit reduced presentation with frame switching and immutable numerical receipts; dual-renderer performance and sustained physical-device GPU acceptance remain final QA. Persisted historical reconstruction and authentication await published contracts. Broader operational-card and specialist-provenance improvements remain PR5.
