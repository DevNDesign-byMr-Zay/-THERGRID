# ÆTHERGRID rescore readiness — October 14, 2026

## Verified application candidate

The verified main commit is `9c2957f51fff0c0a58d2d71bc492a8cc30599fbb` (tree `e6baa7bd4ce7c1cc8a30e6fb7c2e35315d371019`). The application is a Node.js backend and React/TypeScript/Cesium frontend, not infrastructure as code. Docker packages and tests this application; it does not provision infrastructure.

- [Engineering CI](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38508704961): root tests, unchanged coverage gates, lint/format, typechecks, fresh-clone smoke, health container and canonical packaging passed.
- [CodeQL](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38508705001): passed on that main commit.
- [Canonical acceptance](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38508833100): 147 browser tests passed, 3 skipped in the credential-free phase; 2 credentialed Cesium tests then passed. Sustained replay was separately verified for fifteen real minutes on the source-identical final feature tree in [run 38506888786](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38506888786).
- [Sanitized canonical receipts](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38508833100/artifacts/11869564479): real VÆLON/AUREN/SOLVÆR and TEAM provider responses without fallback; current weather, 120 forecast samples, EIA NYIS, NOAA BATN6 and Transitland feed discovery. NYC Ferry returned a fresh empty trip-update feed outside operating hours; this is not vehicle-position verification.
- Cesium receipts verified source terrain, imagery and 25 city building tiles, plus globe-to-city descent. This is successful tile loading, not surveyed/PBR skyline certification or physical-device GPU performance certification.
- IBM IAM and authenticated discovery returned three hardware backends. No quantum job was submitted or executed. D-Wave remains unconfigured and on hold.

## Latest external assessment baseline

The supplied September 28 assessment (`ÆTHERGRID(1).pdf`) scores the repository 60/C, assigns `Infra 100%`, and says no runnable suite was detected while simultaneously describing the existing tests and application architecture. Those static-analysis statements do not override executed CI evidence. The report states that scoring never executes code; repository metadata and visible commands therefore matter.

| Assessment concern | Current evidence / action |
| --- | --- |
| Undetected runnable tests | Conventional `npm test` uses Node's test runner; root lockfile, explicit README commands and required CI jobs are present. The candidate executed 534 tests. The container-bind follow-up adds two behavior tests (536 passing locally). Do not add a fake test framework merely to satisfy detection. |
| Infra misclassification | `.repo-class.json` says `application-service` and excludes `infrastructure-as-code`; README and `docs/PROJECT_SCOPE.md` agree. No fake Terraform/Kubernetes is appropriate. |
| Whole application startup | Existing Compose only ran the health service. The follow-up adds the canonical application image, frontend build, API runtime, writable profile volume and host-loopback port. New CI probes both services and profile persistence after restart. Docker execution must pass remotely before this follow-up is called verified. |
| Short maintenance history | Actual history extends from September 12 through October 13 in the inspected main. Preserve genuine history; do not manufacture authors, dates or commits. |
| Duplicate evidence primitives | Some canonical/fingerprint/freeze helpers remain duplicated. A behavior-preserving refactor is a separate maintenance opportunity, not proof that the app fails to run. |
| Dependency freshness | Weekly Dependabot and scheduled outdated evidence exist. The stronger stale-major failure guard recommended by the assessment remains a maintenance gap. |

## Full-service startup and credentials

The canonical application serves frontend and application APIs from one Node process. The independent health service is a second maintained application surface. These are not missing microservices that should be fabricated. `docker compose -f docker-compose.yml up --build` starts both after this follow-up is integrated. Docker Compose 2.24+ and a working Docker installation are prerequisites. Startup without paid-provider keys is supported; live provider features need the corresponding credentials in an ignored runtime environment.

An archive is a delivery container, not an executable. The functional ZIP must be extracted and launched. Its single Windows launcher starts the canonical Node application and opens the browser; it still requires an allowed Node runtime. Opening a ZIP or standalone HTML cannot start backend processes. The optional standalone HTML work is a limited browser-local edition and must not be submitted as evidence of full-service operation.

GitHub Actions secrets belong to the protected CI runtime; downloading a ZIP does not transfer those secrets to a user's computer. Never bundle provider credentials to make the download appear configured.

## Remaining functional blockers

The whole mission is not fully operational while these requirements remain unmet:

1. **Authentication:** PR #172 at `7a4715d` defaults unauthenticated requests to a seeded operator session and permits client-selected roles. Correct fail-closed identity and server-derived permission contracts are required before connecting login/logout/roles.
2. **Recorded history:** the same PR generates sine/cosine weather, fixed pressure and manufactured source timestamps while attributing them to persisted observations. Historical values must instead come from real collected/source-backed timestamped records; missing coverage stays unavailable.
3. **Specialist tools/citations:** registry/MCP classes do not establish callable HTTP agent execution, tool authorization, persisted task receipts or citations. Frontend integration requires a published, tested response contract; model response verification is not factual verification.
4. **Quantum experiment integration:** PR #168 is a separate unmerged experiment/cancellation workstream. Authenticated discovery does not prove hardware execution. No paid hardware submission is authorized by this rescore-readiness check.
5. **Physical-device acceptance:** cloud Chromium/software GPU evidence does not certify this user's restricted Windows device or iOS installation/WebGL performance. Apple-signed iOS installation is not available from a ZIP.

The rescore may evaluate the delivered application subset with these limitations accurately disclosed. A score, offer, or improvement to 80+ is not guaranteed. Full-project completion cannot be inferred from green CI alone.

## October 27, 2026 engineering hardening candidate

The later `2d0bc3c` main clone (not the October 14 verified-main candidate above) already contained 627 passing conventional Node tests, a committed root/web lockfile, a production web build and maintained CI. The October 27 `fix/high-impact-score-recovery` review branch adds independently verifiable improvements:

- **Fresh-clone and PowerShell:** `npm run syntax` now invokes a portable Node ESM verifier instead of GNU `find`/`xargs`; explicit tests cover invalid nested files and generated-directory exclusions.
- **Credential-free proof:** `npm run test:offline` runs the conventional suite with provider secrets removed from the child process and non-loopback Node TCP/TLS/fetch access blocked; CI runs it on pull requests and main. This is not host-level network isolation.
- **Configuration parity:** Root and app `.env.example` now enumerate schema/runtime/launcher overrides with blank credential fields. One-time setup passwords must not be persisted.
- **Cohesive city analysis:** The 500-plus-line pure city metrics/planning subsystem moved from `server.mjs` into three focused modules under `analysis/`, preserving the server exports and HTTP contract. Release verification and ZIP inventory were updated to require the modules.
- **Web dependency remediation:** The separate web audit initially reported one critical DOMPurify and one high Vite vulnerability. `dompurify@3.4.17` and `vite@8.3.5` are locked, the audit now reports zero vulnerabilities locally, and engineering/v4 web CI each has an explicit web audit gate.

The offline test suite passed **641/641 tests on supported Node 22.23.4**, including regression checks for Windows-compatible `file:` imports, credential aliases, nested test discovery and numeric-string TCP socket overloads identified by independent code review. The Windows launcher workflow now runs dedicated offline/portable checks on Windows. Root release packaging, ZIP startup smoke, lint, typechecks, formatting, coverage and demos passed in the final `npm run check` run; the patched web dependencies passed `npm ci`, `npm run build` and `npm audit --audit-level=moderate`. Chromium acceptance was attempted, but its browser download returned a truncated archive in this execution environment. The PR's browser and Windows CI results must be checked before merging or claiming equivalent browser acceptance. No independent external rescore has been performed for this candidate.

## October 28, 2026 renderer/modularity continuation candidate

After PR #208 merged, PR #209 merged nine fixture-driven, executable NWS hazard-service regressions into `main` (`b30a3e585b090bdd65d7c4cfab7809ce280933f0`). This follow-up review branch starts from that exact merge. It is **not** an external buyer rescore or a deployed application.

- Extracted the original native WebGL color, severity, layer and visual-mode rules into `renderer/native/native-palette.ts`, and Cesium visual/solar tile expressions into `renderer/cesium/visual-mode-palette.ts`. Values and alpha are intentionally preserved; new behavior tests execute both pure modules and the existing Cesium presentation controller.
- Extracted all eight city targets, default layer/mode lists and validated coordinate search into `app/city-targets.ts`. Representative named/partial and boundary coordinate cases now execute directly rather than depending on a source-text assertion.
- Extracted stateless city streaming/loading and NWS/GTFS/NWPS source badges into `components/LiveSceneBadges.tsx`. New tests render the actual component through Vite's React transform to check live/stale/fallback/partial/unconfigured/unavailable and non-live cases without provider credentials.
- Updated 13 legacy root source-location-sensitive assertions to read their current module owners. These existing assertions still check integration/source structure; the 12 new web tests add real palette, search and component behavior coverage.
- Wired all three new regression specs into the existing pull-request v4 web `temporal` spatial-contract step, so pre-merge CI now exercises their behavior rather than waiting for post-merge canonical discovery.
- Measured file-size reductions: `App.tsx` **2,997 → 2,722** lines, `native-webgl-renderer.ts` **1,511 → 1,444**, and `visual-mode-controller.ts` **180 → 151**. The moved rules are now in smaller modules with their own tests; this does not claim the remaining large files are already fully modular.

**Fresh branch verification (Node 22.23.4):** `npm run check` passed release readiness, both archive builds, canonical ZIP startup smoke (1,330 file hashes checked), 231-file syntax verification, lint, both root typechecks, formatting, coverage and demos. Root `npm test` and credential-scrubbed `npm run test:offline` each passed **647/647**, zero failures/skips. Coverage remained above unchanged thresholds: **94.73% lines, 81.37% branches, 95.91% functions**. Web TypeScript and production Vite build passed; the separate web `npm audit --audit-level=moderate` reported **0 vulnerabilities**. New/existing focused Playwright Node tests passed **22/22** (12 added; 10 preexisting).

**Still unverified:** The 13-test command-center Chromium run could not launch because the Playwright browser binary is absent. A fresh `npx playwright install chromium` attempt repeatedly received a **0 MiB/truncated archive**, matching the earlier environment blocker. Opera Browser Connector reported **not connected** (requires Allow AI connection and Opera sign-in). Neither a cloud-browser visual inspection, Windows device acceptance, protected exact-main CI after merge, nor a fresh buyer score is claimed. The production Vite build still warns about its approximately **4.85 MB** main JavaScript chunk; code splitting remains a separate reviewable performance opportunity. The `App.tsx` and native renderer still exceed one thousand lines, so further safe decomposition is possible and should be assessed independently.

Independent review also noted a pre-existing palette input limitation: the native `rgba()` parser assumes controlled six-digit hex values and does not validate malformed input. Its callers currently supply controlled literals. Input validation is deferred to a separate behavioral change; this extraction does not claim to make arbitrary color strings safe.

Before requesting a buyer rescore, require a reviewed merge, exact-new-main Engineering CI and CodeQL, responsive browser acceptance, and a new sanitized canonical evidence report. Do not substitute this local verification for those protected gates.


## October 29, 2026 — spatial-control accessibility follow-up

After #210 merged into main (squash `9b21b8bb9f541563852b54049c401627807dd613`), its engineering, web, Windows and CodeQL workflow runs were all successful. A later screenshot review identified a narrow spatial toolbar with an invisible horizontal scrollbar that could hide the REALITY selection on smaller viewports.

The follow-up branch extracts the existing controlled toolbar from the oversized `App.tsx` into `components/StageToolbar.tsx` and adds bounded previous/next controls, normal horizontal keyboard scrolling, explicit selected scope states, a visible thin scrollbar and focus indicators. It preserves the existing WORLD/CITY, INSPECT/MEASURE/AREA and seven visual-mode callbacks; this is an operator UX/maintainability refinement, not a new city-data or 1:1 photorealism claim. A browser regression at 390x844 checks Reality reachability, selection and whole-page horizontal overflow. CI results on the new head are required before declaring that follow-up verified.

## October 29, 2026 — subsequent DataFactor recovery cycle

The latest externally supplied DataFactor assessment is **56.9/C (October 27, 2026)**, with Code Cleanliness 35, Architecture & Robustness 58 and Test Coverage 55. These are *external* scores, not new computed values. Score-recovery PRs #209–#216 have merged into `main`; the confirmed squash checkpoint before this branch is `5de304d8fb86cb4ac2c872a32f6d56bd0bafe2bc`. The full merged candidate is not automatically a release, an external rescore or proof of real-world 1:1 city geometry.

This follow-up extracts layer feature-count calculation from the oversized React `App.tsx` into a pure typed module, preserving city/world and live/non-live source boundaries. A dedicated Playwright-executed contract checks mapped feature counts, local annotations, 4D temporal mode masking and an aviation-snapshot refresh. The latter fixes a previously omitted `aviationOverlay` dependency in the original `useMemo`. These contracts must pass exact-head web/engineering acceptance before merging; external score improvements must be checked against the next DataFactor report.

Separately, PR #217 tightens environment-template coverage against actual runtime source references. Keep these changes in distinct reviews to avoid combining unrelated code and environment concerns.
