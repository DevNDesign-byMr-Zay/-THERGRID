# Convergence checkpoint — 2026-10-06 UTC

## Integrated contracts

- Backend #145 and frontend #144 are merged. Frontend integration SHA: `81be3112faa76e76482ae440de74520c9341dbf3`.
- Repository story/classification/reference cleanup #147 merged at `2f45805f9cf47a47bc7680ca34b31fbc714a46cb`.
- Canonical application migration #148 merged at `610c01dd79a52180ceaa3350944fd522aa810934`, verified against live GitHub and the fetched tree.
- The Node server serves `web/dist/`; API 404s do not become SPA HTML, missing builds fail visibly, full-app packaging builds React and packaged-runtime smoke probes that application. Native v3 compatibility lives under `legacy/`.
- This reconciliation updates startup/status, roadmap and version roles. Root package/lockfile/changelog and the delivery-coupled evidence-console manifest identify the unreleased `0.2.0` candidate. Canonical application manifests and the private web workspace identify `4.0.0-alpha.1`. No release or tag is created.

## Preliminary reconciliation validation

On Node 22.23.3, the reconciliation tree passes `npm test` (502 tests, zero failures) and the complete local `npm run check`: release readiness, both archives, canonical packaged-runtime smoke, syntax, lint, typechecks, formatting, coverage and deterministic demos. Coverage: 92.49% lines, 74.67% branches, 94.72% functions; enforced thresholds unchanged.

These checks are **not** the final exact-main submission gate. GitHub gates and final provider evidence must be bound to the final merged submission SHA.

## Exact-main canonical live run and transit recovery

PR #151 merged the protected canonical live gate at exact main `80b30b886445a82b3f3eb171c6fe9a257eb243a4`. Engineering CI and CodeQL passed on that SHA before dispatch. The first retained canonical run verified the React command center, authenticated Cesium terrain/imagery/building tiles, all three Groq specialists plus TEAM, Tomorrow.io current/forecast, EIA NYIS and NOAA BATN6. IBM remained blocked only by the absent service CRN and D-Wave by the absent token; no hardware job was submitted.

That run correctly failed instead of promoting partial evidence because Transitland and NYC Ferry each returned zero accepted records. The recovery work treats those as two contract issues rather than weakening acceptance:

- Transitland discovery now uses the documented `/feeds` catalog with a geographic query around Midtown and returns source feed metadata directly. The prior adapter queried `/agencies` and expected a direct `agency.feeds` shape that is not the current REST response contract.
- NYC Ferry's current official Developer Tools page advertises real-time **Trip Updates** and **Alerts**, not a vehicle-position feed. The verified runtime binding therefore uses the documented trip-update endpoint and labels its dataset `transit-trip-updates`; the UI still renders vehicle-position overlays only when actual coordinate-bearing vehicle records exist. No positions are inferred from trip updates.

Acceptance continues to reject stale, fallback, empty and metadata-only success.

## Outstanding prerequisites

1. Confirm all intended safe city-provider hardening is merged. The event for #148 establishes canonical migration, not completion of a separate hardening lane; no open city-hardening PR was found at inspection time.
2. Land/identify the protected canonical live-provider workflow. The currently maintained `aethergrid-live-provider-smoke.yml` has no protected environment and its script checks AUREN alone and `cesium-config`, not all specialist agents/TEAM or real Cesium terrain/imagery/building tiles. Running it cannot satisfy the requested acceptance contract.
3. After all intended work is merged, run every maintained release gate on one exact final main SHA, including web/browser, fresh-clone/container and CodeQL, then the comprehensive protected live-provider gate with sanitized artifacts. Do not promote historical live receipts to final evidence.
4. IBM hardware remains unconfigured/degraded without a verified service CRN. D-Wave hardware remains unconfigured without a Leap/SAPI token. Production hosting, secret injection and persistence remain deployment work.

The webhook watch remains enabled for subsequent merges. No hardware job or release was submitted by this checkpoint.

## Canonical acceptance gate implementation

The verification lane adds `aethergrid-canonical-live.yml` and canonical browser mode. The gate refuses a mismatched/superseded main SHA or absent exact-main successful Engineering CI/CodeQL push runs; credentials enter only the final provider/browser step. Its receipt checks reject fallback, stale, empty or metadata-only observations. Uploaded evidence excludes raw responses, browser traces and screenshots. The six installed repository secrets are reused; IBM service CRN and D-Wave token remain optional configuration blockers, never hardware validation. Final submission remains pending merge and exact-main live execution; prior checkpoint counts are historical, not final results.
