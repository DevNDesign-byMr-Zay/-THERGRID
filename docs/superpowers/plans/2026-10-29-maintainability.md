# Maintainability implementation plan

**Goal:** Make clean-checkout verification explicit and keep application modules focused without changing operator behavior.

**Architecture:** Preserve the Node backend, React/Cesium runtime, safety boundaries, direct-open HTML and existing coverage thresholds. Extract cohesive responsibilities behind the current public interfaces; add behavioral tests before each extraction.

**Constraints:** No assessment scores in source. No fabricated contributors or historical commits. No automated dependency-update PRs. Keep changes scoped and reviewable.

1. Audit `src`, `apps` (including the React workspace) and `scripts` environment access expressions. Test missing keys in both templates, bracket access, destructuring and ignored generated/vendor folders. Add documentation and a blocking release-readiness check.
2. Unify root test discovery across normal, JUnit, offline and coverage runners. Test nested files and failure propagation. Retain coverage thresholds 84/70/85 and publish clean-install Node 22 evidence.
3. Extract legacy settings and environment helpers with unit tests. Preserve classic-script ordering, service worker assets and standalone archive inlining.
4. Extract React workspace panels, operational context and weather context into hooks with lifecycle tests. Preserve drawer accessibility, abort behavior and provider provenance.
5. Enforce a 500-line ceiling for maintained source. Record existing oversized modules with bounded exceptions and prevent their growth. Verify JavaScript and TypeScript source through the lint command.
6. Verify the independently locked web dependency graph in CI; publish informational freshness output while keeping actual install/audit failures blocking. Clarify small commits and independent human review in contribution guidance.

**Verification:** Node 22 full tests, JUnit, offline tests, coverage, lint, formatting, release readiness, root/web typechecks, production/direct-open builds, full app packaging and smoke. Review the final diff and inspect Actions for the exact PR head.
