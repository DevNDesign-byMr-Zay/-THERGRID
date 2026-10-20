# Repository quality and maintainability hardening plan

**Date:** 2026-10-20  
**Target:** ÆTHERGRID / THERGRID (Node 22, React/TypeScript, Cesium)  
**Base:** `ea68389e3c9d05e6cee0044cc147417ca3683d70`  
**Status:** In progress; land only after CI and browser verification

## Goal and non-goals

Improve the repository's actual maintainability, test evidence and developer experience without weakening operational assurance. No history rewriting, artificial contributors, test-count padding, external-assessment terminology, or claims of hardware validation. Preserve the canonical React/Cesium build, the offline/native fallback, backend contracts, the packaged ZIP, and advisory/no-actuation behavior. Live-provider failure must remain visible; ordinary deterministic CI must not depend on provider uptime.

## Observed baseline

- Root `package.json` already exposes `npm test`, blocking `npm run coverage`, and `npm run check`; Engineering CI exercises all three and saves raw V8 coverage.
- `tests/` contains 94 root Node test files and `tests/js/` contains two nested Node test files.
- Canonical application is `apps/aethergrid-console/web/src/app/App.tsx` (about 110 KB); `apps/aethergrid-console/app.js` (about 198 KB) is **legacy compatibility** and not the main production UI.
- Root Engineering CI is deterministic; `aethergrid-canonical-live.yml` intentionally checks externally authenticated integrations on an exact SHA.
- Root README currently repeats verification sections and mixes historical evidence with the present operating instructions.
- Existing CI gates and release-readiness source checks depend on stable filenames and workflow roles; preserve those interfaces.

## Task 1 — Make test results reviewable and reproducible

**Files:** `package.json`, `.github/workflows/ci.yml`, `tests/test-reporting.test.mjs`, `docs/TESTING.md`

1. RED: Add a contract test that checks the Node test invocation uses the conventional suite, coverage thresholds stay at 84% lines / 70% branches / 85% functions, and Engineering CI produces a real JUnit XML file while retaining human-readable output.
2. GREEN: Add a reusable `test:report` script with Node's built-in `spec` + `junit` reporters, directing XML to `test-results/node-tests.xml` while keeping `npm test` as the unchanged default. Wire the CI `test` job to `npm run test:report` and upload that report even on failure. Do not report success if tests fail.
3. Add a structured testing guide documenting Node, frontend Playwright, deterministic fixtures, coverage threshold ownership, optional live checks and exact local commands.
4. Verify `npm test`, `npm run test:report`, `npm run coverage`, `npm run verify:release`.

## Task 2 — Separate canonical shell configuration from orchestration

**Files:** `apps/aethergrid-console/web/src/app/App.tsx`, `apps/aethergrid-console/web/src/app/spatial-defaults.ts`, `tests/aethergrid-spatial-defaults.test.mjs`

1. RED: Add an explicit contract checking maintained city camera targets (NYC, London, Tokyo, Dubai, Singapore, São Paulo, Lagos, Sydney), selectable visual modes, and layer defaults. Guard against duplicate, invalid or renamed identifiers.
2. GREEN: Move immutable `CityTarget`, `CITY_TARGETS`, `INITIAL_LAYERS`, and `VISUAL_MODES` out of the 2,911-line React component into one typed, audited module. Import them in the app. Do not change values or JSX.
3. Keep future extraction small: temporal fetching, scenario controls and other hooks should move only once they have behavioral regression coverage.
4. Verify TypeScript/web build, Playwright canonical browser regression, Node integration regression, and provider-secret boundary.

## Task 3 — Remove duplicated or ambiguous contributor guidance

**Files:** `README.md`, `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, `docs/TESTING.md`

1. Explain exactly which entrypoints are production (`npm run aethergrid-app`), health (`npm start`), legacy, standalone ZIP, and Docker.
2. Document the source-backed versus fallback behavior; the provider state contract; the no-actuation boundary; and which tests are local versus live. Link existing `docs/PROVIDER-ARCHITECTURE.md`, workflow files and browser readme rather than copy their contents.
3. Consolidate duplicated root README verification paragraphs with no loss of technical instructions or existing evidence links.
4. Verify formatting and existing release-readiness contracts.

## Task 4 — Validate checks and report outcome accurately

1. Run `npm ci --ignore-scripts`, `npm run test:report`, `npm run coverage`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run typecheck:strict-renderer`, `npm run package:aethergrid-app`, and `npm run smoke:aethergrid-app` on a fresh clone/CI equivalent. Web build and Playwright are independently required.
2. Require exact-head Engineering CI, CodeQL, web CI and focused browser smoke to pass before merge; preserve protected live-provider acceptance as a separately labeled external check.
3. Commit in focused increments on the work branch and merge only green changes. Any unavailable runner or permission must be stated explicitly; do not fabricate verification.
4. If a credentialed provider remains degraded/unconfigured, retain truthful provider evidence and identify that externally blocked capability separately from product correctness.

## Risk controls

- Never refactor the legacy `app.js` as a substitute for canonical React improvements.
- Do not change coverage thresholds, test assertions to accept false outcomes, CI protected environment permissions, token exposure, or no-actuation policy.
- If a code extraction changes runtime behavior or breaks test snapshots, revert the extraction rather than removing the failing regression.
- No changes to git author history or misleading contributor evidence.
