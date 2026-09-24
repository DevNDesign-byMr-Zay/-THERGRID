# Changelog

## Unreleased — pre-rescore detector hardening

### Added

- Pinned ESLint, Prettier, and TypeScript as exact local development dependencies with a synchronized npm lockfile and release-readiness parity checks.
- Machine-readable and reviewer-facing classification identifying THERGRID as a Node.js application service rather than infrastructure-as-code.
- An explicit conventional `npm test` CI signal so automated scanners can detect the runnable suite.
- Release-readiness enforcement that preserves the application-vs-IaC boundary.

### Changed

- Current package candidate: `0.1.2`. The `v0.1.1` release is the latest hosted milestone; this candidate is not published until the gated manual release workflow publishes it.

## 0.1.1 — 2026-09-24 — post-release hardening

### Added

- Provider-neutral startup/config error reporting with bounded context and isolated reporter failures.
- Raw V8 coverage retention from the exact blocking Node coverage run.
- Canonical runtime/type-check support for the platform health and observability surface.

### Changed

- Root container/runtime discovery and environment metadata are now validated through the maintained release-readiness contract.
- Published as `v0.1.1` on 2026-09-24 through the gated manual release workflow.

## 0.1.0 — 2026-09-24 — deterministic spatial-intelligence hardening

### Added

- Deterministic synthetic microgrid pipeline spanning validated snapshots, TwinState, forecast, advisory planning, simulation, decision receipts, provenance, SpatialScene, render packets, and operator review evidence.
- Renderer-neutral holographic presentation contracts for HoloMat, projector, volumetric 3D, AR/VR, and conventional dashboard clients.
- SOLVÆR collaboration boundaries with immutable request/evidence identity, solver comparison evidence, fallback provenance, promotion gates, and explicit non-authoritative safety.
- Operator-attention contracts with affected metrics, advisory actions, snapshot staleness boundaries, source-backed asset/node scope, and sealed read/dashboard projections.
- Spatial evidence layers for validated topology, asset power flows, forecast deltas, simulation evidence, policy gates, provenance, and solver comparison.
- Structured platform health/status service, Docker/Compose verification, dependency auditing, coverage gates, CodeQL, and an evidence-based release-readiness verifier.

### Changed

- Release readiness now preserves the security policy, contribution guide, review ownership, and pull-request validation template as required governance.
- Gated releases now attach a CycloneDX dependency SBOM, exact commit evidence, and SHA-256 checksums.
- Release evidence now includes a machine-readable manifest binding the requested tag, package version, and exact commit SHA.
- Manual release evidence is checksum-verified and retained as a workflow artifact before GitHub publication so failed publication does not discard the verified bundle.
- Spatial and operator presentation paths now retain validated source identity instead of reconstructing or inventing asset/node scope downstream.
- Renderer-bound evidence remains advisory-only, non-authoritative, and non-actuating even when simulation or solver evidence is eligible for operator review.
- Release verification now proves the repository's reproducibility, safety, evidence, and security gates before a release is considered ready.
- Dependency maintenance now has an explicit weekly npm and GitHub Actions update contract, and release readiness fails if that automation disappears.

### Release policy

- Published as `v0.1.0` on 2026-09-24 through the gated manual release workflow.
- This changelog records real repository work only.
- Advanced solver output never becomes authoritative solely because it outperforms a baseline.

