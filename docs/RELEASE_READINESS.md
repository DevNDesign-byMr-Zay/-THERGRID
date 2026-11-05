# Release Readiness

THERGRID releases are evidence-bearing engineering milestones. A version is not considered publishable merely because a tag can be created.

## Required state

The current package candidate is **0.3.5**, pending reviewed integration and exact-main verification. Published releases through `v0.3.4` remain immutable. The verified `34c18d17783e085f90bbebf7eea1b11483cbb5c3` baseline and its dated workflow evidence are recorded in [engineering readiness](RESCORE_READINESS.md); they do not certify the new candidate. The exact `main` commit proposed for release must pass:

- reproducible `npm ci --ignore-scripts`;
- dependency audit at moderate severity or higher;
- release-readiness verification;
- syntax, lint, and formatting gates;
- root tests and enforced test coverage without reduced thresholds;
- React workspace typecheck/build, web/browser acceptance and canonical packaged-application checks;
- deterministic evidence and dashboard demos;
- Docker Compose validation plus `/health` and `/status` runtime smoke checks;
- CodeQL JavaScript/TypeScript analysis;
- real Qiskit Aer bridge/integration and Windows launcher checks.

Run the maintained local contract with:

```bash
npm run check
```

The manual release workflow reruns the deterministic release candidate path and attaches a CycloneDX SBOM, exact commit evidence, a machine-readable release manifest binding tag/version/commit, and SHA-256 checksums.

The protected canonical live-provider workflow must then target that same SHA using encrypted Actions secrets and retain a sanitized report. The default `local-simulator` profile verifies the maintained bounded sampler/estimator and keeps every other live-provider gate. The strict authenticated IBM discovery profile remains opt-in. Record IBM as unverified in software-only runs and do not infer hardware submission/execution. Validate actual configured providers and report missing credentials explicitly. Do not substitute historical provider receipts for this run.

## Safety and authority

Release readiness does not grant operational authority. Simulation remains upstream of any future actuation. Operator attention, solver comparisons, SpatialScene data, and renderer packets stay advisory, renderer-neutral, non-authoritative, and non-actuating unless a future explicitly reviewed authorization contract changes that boundary.

Advanced solver evidence must continue to include a classical baseline and measurable comparison criteria.

## Version discipline

`package.json` is the release version source of truth. [VERSIONING.md](VERSIONING.md) distinguishes repository semver, product generation, legacy app/schema versions and the private web workspace generation. The requested tag must equal `v<package version>`.

Do not backdate, fabricate, or multiply releases to create artificial history. A new version should represent a real capability, safety, security, compatibility, or reproducibility milestone.

## Publication

The `release/github` workflow is manual-only and must run from `main`. The version-specific request bridge dispatches it only after successful canonical acceptance on the same current main SHA, matching intent/version and absence of the published release. Retired requests skip safely. The publication workflow independently refuses superseded main, mismatched versions and existing tags, verifies checksums and preserves immutable artifacts. Matching `docs/releases/v<version>.md` notes are included alongside generated notes when present. Passing readiness does not claim a release already exists.

For direct-open GUI use, extract `aethergrid-functional-app.zip` and open root `index.html`. Full runtime use needs the Windows `.cmd`/`.ps1` launcher, an allowed Node.js 22 process and optional configured credentials. HTML cannot silently start protected services. Follow [v0.3.5 release notes](releases/v0.3.5.md) for checksum verification: the ZIP entries are recorded under `dist/`, so flat downloads require restoring that directory layout before `sha256sum --check`.
