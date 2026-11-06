# ÆTHERGRID engineering readiness — November 5, 2026

## Verified main baseline and pending candidate

The verified baseline is `34c18d17783e085f90bbebf7eea1b11483cbb5c3`. The current package candidate is **0.3.5**. Its reviewed integration, exact-main verification and publication remain pending; the results below belong to the baseline.

| Evidence | Verified baseline result |
| --- | --- |
| [Engineering CI](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/41956848200) | 729 Node tests passed; 95.38% line, 83.36% branch and 96.11% function coverage |
| [CodeQL](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/41956847547) | Passed |
| [Real Qiskit Aer](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/41956847543) | Actual simulator bridge and integration passed |
| [Canonical acceptance](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/41957050578) | 258 browser tests passed, 3 skipped; 2 additional credentialed Cesium tests passed |
| Live sources | Agents, weather, energy, hydrology and transit verified; NYC Ferry fresh-empty outside service hours, source age 6 seconds |
| Spatial rendering | Terrain, imagery, 25 building tiles and globe-to-city descent verified |
| Quantum report | `profile: local-simulator`, `passed: true`, `failed: []`, `ibmVerified: false`; no hardware submission or execution |

The application is a Node.js backend and React/TypeScript/Cesium frontend. Docker packages and tests the application. It does not provision infrastructure.

## Candidate scope and verification boundary

Version 0.3.5 adds native context-listener ownership before initial WebGL allocation, restoration using current renderer state, source-preserving legacy geometry extraction and normal/inline fallback startup regressions. Public APIs, source provenance, ordering, camera/time/layer/selection behavior, agents and solver paths are preserved. Required verification remains the unchanged root quality gates, offline/JUnit evidence, root/web audits, deterministic renderer and hooks tests, actual-context browser tests, Windows launcher checks, real Aer and protected exact-main canonical acceptance. Local deterministic evidence cannot replace remote browser/Windows or exact-main results.

Software quantum acceptance exercises the maintained bounded local sampler/estimator. Strict authenticated IBM discovery remains an opt-in protected profile; it is not hardware execution. D-Wave remains unconfigured/on hold. No paid hardware submission or hardware certification is authorized or claimed.

## Local startup and remaining limits

Extract `aethergrid-functional-app.zip` and open its root `index.html` for direct-open GUI operation. Full service use requires `START-AETHERGRID.cmd` or `START-AETHERGRID.ps1`, an allowed Node.js 22 process and optional configured provider credentials. HTML cannot silently start protected processes. CI secrets are never transferred into downloaded archives. See [v0.3.5 notes](releases/v0.3.5.md) for checksum layout and [release readiness](RELEASE_READINESS.md) for publication gates.

Docker Compose requires Docker and Compose 2.24+; the canonical app and independent health service are maintained application surfaces. Physical-device Windows/iOS acceptance, GPU performance, signed iOS distribution, production deployment and operational authority remain separate work. Source tile loading does not certify surveyed geometry or physical performance. Specialist/model responses remain advisory and are not independent factual verification. Large remaining modules and the production web bundle remain maintenance/performance work tracked through the repository's module-size debt records.

## Dated historical evidence

- [October 14 canonical acceptance](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38508833100), commit `9c2957f51fff0c0a58d2d71bc492a8cc30599fbb`: 147 browser passes, 3 skips and 2 credentialed Cesium passes, including authenticated IBM discovery of three backends without hardware execution. This is historical, superseded by the verified baseline above.
- [Historical fifteen-minute replay](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38506888786) covered the source-identical feature tree for that earlier milestone, not v0.3.5.
- October 27–29 hardening introduced portable syntax/offline checks, dependency remediation and renderer/UI decomposition. The contemporary local counts and browser-download limitations remain in git history; they do not describe current exact-main acceptance.
- Experimental [PR #172](https://github.com/DevNDesign-byMr-Zay/-THERGRID/pull/172) and [PR #168](https://github.com/DevNDesign-byMr-Zay/-THERGRID/pull/168) were separate unmerged workstreams in the historical review. Their authentication/history and quantum-experiment findings must not be presented as vulnerabilities or delivered functionality of the verified main baseline.

External assessment documents remain separate historical inputs. This readiness record reports executed engineering evidence and makes no new assessment or commercial claims.
