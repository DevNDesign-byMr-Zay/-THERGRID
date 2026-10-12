# Operational timeline acceptance — 2026-10-12

This frontend branch adds exact source-sample forecast selection, selected forecast replay ranges, real replay rates, and explicit unavailable history to the canonical React/Cesium application. It does not supply persisted historical observations or authenticated sessions.

## Behavior and evidence

- LIVE uses the live clock and cannot replay. Mode changes, scrubbing and replaced coverage pause transport.
- FORECAST selects only valid returned instants. A 12:00 / 13:00 / 15:00 UTC series never creates a 14:00 observation. Selected range endpoints bound replay; the cursor is never silently clamped into coverage.
- Ambiguous local timestamps require the forecast's own returned UTC offset. Invalid calendar dates, fallback samples and missing coverage are excluded. Open-Meteo's existing adapter omits that forecast offset; those ambiguous samples remain unavailable pending Jules' metadata contract.
- Valid time, model-run time and fetch time remain separate. Missing receipts show UNKNOWN. Stale weather retains its value and STALE state. Dossiers retain forecast identity and exclude current-only observations outside LIVE.
- HISTORICAL hides current observations and states that persisted observations and historical building reconstruction are unavailable. Static mapped geometry is not a historical reconstruction.
- SCENARIO remains a modeled operator context; replay awaits a supported modeled range in the next spatial-tools workstream.
- HTTP 503 gives an explicit unavailable state and functional retry. Pending requests show LOADING. Switching cities aborts the old request and prevents its receipt replacing the new city.
- Comparison frame captures copy their selected range. Existing bookmarks still store the frame cursor, rather than a replay window; saved-view range support remains subsequent work.

## Verification

Before review, a serial run passed 26/26 timeline, forecast and weather cases (1.7 minutes), including six compiled browser cases. After the review fix, the focused clock/forecast/weather suite passed 21/21 (1.9 seconds) and the separate compiled browser suite passed 6/6 (1.7 minutes), both exit0. The latter blocks external browser requests and isolates unrelated APIs; these remain offline contract tests. Production TypeScript/build passed. Engineering `npm run check` after the review fix passed with 534 tests, zero failures and unchanged coverage thresholds: 92.41% lines / 75.15% branches / 94.78% functions.

```sh
AETHERGRID_TEST_CANONICAL=1 AETHERGRID_TEST_CHROMIUM=/tmp/aethergrid-chromium \
  npx playwright test operational-timeline-browser.spec.ts operational-timeline.spec.ts \
  forecast-frames.spec.ts weather-contract.spec.ts --workers=1 --reporter=line
```

The shell/workspace regression on this timeline branch passed 32 cases; two credentialed/live-source cases were explicitly skipped. A larger regression was interrupted by a runtime network-approval cancellation and is not counted as a full pass. The first final browser attempt was invalidated by a concurrent packaging dependency reinstall; it is not counted as acceptance. Two post-review combined attempts stalled without final test summaries and are not counted as passes. The separate post-review suites above provide final timeline verification. Packaging and browser verification are now serial. The city-renderer PR's exact-head browser/Engineering/CodeQL gates passed separately; this timeline branch still requires its own GitHub gates.

## Independent review

A fresh reviewer inspected the whole branch `9866f648..65e57af`, integration, tests and actual captures. No Critical issues were found. One Important issue was reproduced: pause/resume discarded progress accumulated between source samples. The fix preserves that progress and accounts for elapsed time since the previous tick, while scrubbing, coverage, range or mode changes reset it. The partial-interval regression failed before the fix and passed afterward with the final suites. No second reviewer was dispatched.

Deferred minor: the forecast badge overlaps scene-control labels on desktop and is clipped behind mobile navigation. It does not intercept pointer input, but needs responsive placement and successful mobile forecast/expanded-range/short-landscape/text-zoom verification in final visual QA. The latest mobile unavailable capture also shows the Renderer tools label partially covered by the taller rail; clearance must be tested in the next spatial-tools PR.

Review scope decisions: missing persisted history/authentication/forecast-offset publication remain contract dependencies; scenario replay, bookmark windows and expanded A/B rendering continue in the spatial-tools workstream; native mobile clearance, physical GPU/mobile acceptance, sustained15-minute replay and final visual polish remain unverified. Broader specialist/renderer work is outside this focused diff; D-Wave and release exclusions remain unchanged. These decisions preserve explicit limitations and cost incomplete mission acceptance until the corresponding work is delivered.

Runtime: Node 22.23.3, Chromium 153.0.8010.0, SwiftShader software WebGL. The maintained browser download was corrupt in this environment; a test-only Chromium extraction was used without changing project dependencies. This does not certify physical GPU, physical mobile-device performance or long-running playback stability.

## Actual captures

These are screenshots of the compiled application with real Cesium geometry and isolated API contract fixtures. The single building is a timeline test fixture, not a New York reconstruction. Forecast and current-weather fixtures are explicitly attributed OFFLINE contracts; they are not live weather evidence. Real-source city evidence is documented separately in the city-renderer acceptance report.

| Capture | Purpose |
| --- | --- |
| [Desktop forecast](2026-10-12-operational-timeline/timeline-desktop-forecast.png) | Exact final sample, UTC frame header, disabled replay at source end |
| [Desktop selected range](2026-10-12-operational-timeline/timeline-desktop-range.png) | Expanded source endpoints and replay stopped at the selected end |
| [Mobile historical](2026-10-12-operational-timeline/timeline-mobile-historical.png) | Current observations hidden and historical limitations visible |
| [Mobile unavailable](2026-10-12-operational-timeline/timeline-mobile-unavailable.png) | HTTP 503, disabled source controls and visible retry |
| [Stale weather](2026-10-12-operational-timeline/timeline-stale-weather.png) | Retained 37°C contract value explicitly marked STALE |

## Outstanding acceptance

Jules' authenticated session/roles and persisted-history APIs are absent at the inspected repository checkpoint. Full synchronized historical overlays, historical comparison reconstruction and access-control acceptance remain incomplete. The forecast badge still shares space with the upper scene toolbar; final visual QA must resolve that overlap. Native fallback mobile rail clearance and physical-device/GPU acceptance remain later checks. D-Wave remains on hold and non-executable; this branch changes no backend adapters, authentication services or release packaging.
