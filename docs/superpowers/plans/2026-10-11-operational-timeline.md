# Source-valid operational timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace decorative time coverage with returned forecast samples, bounded replay and explicit unavailable history.

**Architecture:** The existing clock owns mode/cursor and transport. A focused forecast-frame helper validates returned instants and the responsive rail consumes immutable coverage. Current observations never fill historical or forecast gaps; existing bookmarks and frame captures remain operator-local receipts.

**Tech Stack:** Existing React 19 / TypeScript 7 / Cesium 1.145 / Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-11-canonical-spatial-experience-design.md`

## Global Constraints

- Backend provider adapters, authentication services and release packaging remain outside this frontend workstream.
- D-Wave stays on hold, unconfigured and non-executable.
- Historical observations require Jules' persisted timestamped records and their provenance.
- No historical request may silently fall back to current observations.
- Forecast selection snaps to valid samples or a source-defined interpolation rule.
- Replay speed changes temporal progression, not source refresh cadence.
- Missing authentication or history contracts are explicit unfinished dependencies.

## Review Focus

- Ambiguous local timestamps must not borrow current-weather timezone: task 2 exercises missing/explicit offsets.
- Gaps and out-of-range bookmark cursors must remain unavailable: tasks 1–3 exercise exact membership and no implicit clamping.
- Mode/scrub changes during replay must cancel the old transport: task 1 exercises pause and live invariants.
- Late city forecast responses must not replace the new city's coverage: task 3 retains abort guards and exercises request failure.
- Small screens must retain time/source limitations and keyboard controls: task 3 tests mobile bounds and accessible controls.

---

### Task 1: Bounded source-sample transport

**Files:** Modify `apps/aethergrid-console/web/src/time/temporal-clock.ts`; create `apps/aethergrid-console/web/tests/operational-timeline.spec.ts`.

**Interfaces:** Add `setPlaybackSamples(samples: readonly string[] | null): void`. Existing snapshot/subscribe/play/pause/rate/mode/scrub interfaces remain. Forecast/history replay requires exact membership; null/empty coverage is unavailable. Scenario replay remains disabled until a supported modeled range is supplied.

- [ ] Write failing behavioral tests: LIVE cannot play or retain a historical cursor; changing mode or scrubbing pauses; unavailable coverage cannot play; sorted/deduplicated samples replay at rate 3600 from 12:00 to 13:00 then 15:00, emitting no synthetic 14:00 frame and stopping at end; replacement coverage pauses; invalid rate throws; destroy clears timers. Test clock/timer doubles live only in the test utility, restore in finally.
- [ ] Run `npm test -- tests/operational-timeline.spec.ts --workers=1` and record intended failures.
- [ ] Implement immutable normalized sample coverage, internal playhead, exact emitted frames, bounded stop and live invariants in the existing clock.
- [ ] Run the targeted tests, TypeScript build and root check; commit only passing source/tests.

### Task 2: Explicit forecast instants and receipts

**Files:** Modify `src/services/city-environment.ts`; create `src/time/forecast-frames.ts`; tests in `tests/operational-timeline.spec.ts` (paths relative to the web app).

**Interfaces:** Add optional `utcOffsetSeconds: number | null` to `AtmosphericForecastSeries`, populated only from returned forecast metadata. Export `forecastFrameInstants(series: AtmosphericForecastSeries | null): readonly string[]`. `selectCityEnvironmentForecast(series, cursorIso, utcOffsetSeconds?, maxDistanceMs?)` defaults to exact match; no source-defined interpolation currently exists. Frame helper excludes fallback and ambiguous local times, sorts/deduplicates; explicit ISO offsets normalize to UTC. Issued/model time and fetched time remain separate.

- [ ] Write failing tests for offset-bearing timestamps, naive times with missing/valid offset, stale source coverage, fallback exclusion, duplicated/invalid timestamps, exact gap rejection and outside coverage; load the actual API envelope through an external fetch fixture and restore fetch in finally.
- [ ] Run targeted tests and verify failures describe wrong frame selection/coverage.
- [ ] Implement helper and returned-offset parsing; remove the App's current-weather timezone dependency. Update the existing root source-contract assertion from nearest-sample policy to exact-sample policy, retaining its provenance/fallback checks.
- [ ] Run targeted tests and existing weather tests; commit passing source/tests.

### Task 3: Responsive coverage/transport integration

**Files:** Modify `src/components/TemporalRail.tsx`, `src/app/App.tsx`, `src/app/command-center.css`, workflow `.github/workflows/aethergrid-v4-web.yml`; acceptance tests/document/assets.

**Interfaces:** Rail accepts `forecastSeries?: AtmosphericForecastSeries | null` and `forecastError?: string | null`; derives only returned sample indices. App sets clock coverage from forecast frames when mode/series changes, otherwise null. Mode selection never silently changes an out-of-range restored cursor. Explicit first-sample button and select/range choose exact instants. Rate select uses real clock rates 1/60/3600/86400. Existing event buttons remain local bookmarks/captures, not historical availability.

- [ ] Write compiled failing tests: forecast API fixture returns 12:00/13:00/15:00, rail chooses exact frames, rate changes and end stops; historical disables replay/scrub and explicitly hides current observations; HTTP 503 gives unavailable status; keyboard sample selection; mobile controls/source status within viewport. Preserve existing bookmark/session integration tests.
- [ ] Run against compiled canonical app; confirm failures before changing UI.
- [ ] Implement coverage UI, exact sample selection and responsive tokens. Show model-issued unknown when absent, fetch time separately, valid time and sample/gap semantics; no fixed −6H/+7D availability claim. Historical states persisted observations and historical building reconstruction unavailable; static map timestamp retained.
- [ ] Run build, full root check, applicable full browser suite and real Cesium/native smoke serially; inspect actual desktop/mobile captures. Record unavailable hardware/auth/history and software-GPU limits.
- [ ] Use the required independent whole-branch review, fix important findings in one pass, commit evidence and publish PR 3 stacked on PR 2. Require exact-head Engineering CI, browser acceptance and CodeQL; do not merge/release.

## Coverage boundary

This plan delivers the independently testable forecast transport and honest historical limitations. Persisted history retrieval, physical-device acceptance, full synchronized historical overlays and final A/B polish remain incomplete until their contracts/workstreams are available. Open-Meteo's current adapter omits forecast UTC offset; its naive samples are intentionally unavailable until backend metadata is published. No adapter rewrite is authorized here.
