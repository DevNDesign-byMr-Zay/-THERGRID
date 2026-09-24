# Release Readiness

THERGRID releases are evidence-bearing engineering milestones. A version is not considered publishable merely because a tag can be created.

## Required state

The exact `main` commit proposed for release must pass:

- reproducible `npm ci --ignore-scripts`;
- dependency audit at moderate severity or higher;
- release-readiness verification;
- syntax, lint, and formatting gates;
- enforced test coverage;
- deterministic evidence and dashboard demos;
- Docker Compose validation plus `/health` and `/status` runtime smoke checks;
- CodeQL JavaScript/TypeScript analysis.

Run the maintained local contract with:

```bash
npm run check
```

The manual release workflow reruns the deterministic release candidate path and attaches a CycloneDX SBOM, exact commit evidence, a machine-readable release manifest binding tag/version/commit, and SHA-256 checksums.

## Safety and authority

Release readiness does not grant operational authority. Simulation remains upstream of any future actuation. Operator attention, solver comparisons, SpatialScene data, and renderer packets stay advisory, renderer-neutral, non-authoritative, and non-actuating unless a future explicitly reviewed authorization contract changes that boundary.

Advanced solver evidence must continue to include a classical baseline and measurable comparison criteria.

## Version discipline

`package.json` is the release version source of truth. The requested tag must equal `v<package version>`.

Do not backdate, fabricate, or multiply releases to create artificial history. A new version should represent a real capability, safety, security, compatibility, or reproducibility milestone.

## Publication

The `release/github` workflow is manual-only and must run from `main`. Passing release readiness means the exact commit is eligible for publication; it does not claim a GitHub release already exists.
