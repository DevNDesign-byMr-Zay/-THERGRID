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
