# Release Readiness

THERGRID releases are evidence-bearing engineering milestones. A version is not considered publishable merely because a tag can be created.

## Required state

Before the final submission gate, backend #145, frontend #144, canonical React/Cesium packaging, repository cleanup and intended safe city-provider hardening must be merged. The exact `main` commit proposed for release must pass:

- reproducible `npm ci --ignore-scripts`;
- dependency audit at moderate severity or higher;
- release-readiness verification;
- syntax, lint, and formatting gates;
- root tests and enforced test coverage without reduced thresholds;
- React workspace typecheck/build, web/browser acceptance and canonical packaged-application checks;
- deterministic evidence and dashboard demos;
- Docker Compose validation plus `/health` and `/status` runtime smoke checks;
- CodeQL JavaScript/TypeScript analysis.

Run the maintained local contract with:

```bash
npm run check
```

The manual release workflow reruns the deterministic release candidate path and attaches a CycloneDX SBOM, exact commit evidence, a machine-readable release manifest binding tag/version/commit, and SHA-256 checksums.

The protected canonical live-provider workflow must then target that same SHA using encrypted Actions secrets and retain a sanitized report. Validate actual configured providers and report missing hardware credentials explicitly. Do not substitute historical provider receipts for this run.

## Safety and authority

Release readiness does not grant operational authority. Simulation remains upstream of any future actuation. Operator attention, solver comparisons, SpatialScene data, and renderer packets stay advisory, renderer-neutral, non-authoritative, and non-actuating unless a future explicitly reviewed authorization contract changes that boundary.

Advanced solver evidence must continue to include a classical baseline and measurable comparison criteria.

## Version discipline

`package.json` is the release version source of truth. [VERSIONING.md](VERSIONING.md) distinguishes repository semver, product generation, legacy app/schema versions and the private web workspace generation. The requested tag must equal `v<package version>`.

Do not backdate, fabricate, or multiply releases to create artificial history. A new version should represent a real capability, safety, security, compatibility, or reproducibility milestone.

## Publication

The `release/github` workflow is manual-only and must run from `main`. Passing release readiness means the exact commit is eligible for publication; it does not claim a GitHub release already exists.
