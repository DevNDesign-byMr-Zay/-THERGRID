# Version scheme

Repository release semver and product generations identify different contracts. A product label must never choose the GitHub release tag automatically.

| Surface | Version | Meaning |
| --- | --- | --- |
| Root `package.json` and `package-lock.json` | `0.2.1` | Current unreleased repository/package candidate; release tags must match this source of truth |
| Latest published GitHub release | `v0.2.0` | Published October 7, 2026 from an earlier SHA with the previous operator-console ZIP, not the latest canonical functional ZIP |
| ÆTHERGRID product generation | `v4` | React/Cesium command-center generation and its provider runtime work |
| Canonical `apps/aethergrid-console/web/` workspace | `4.0.0-alpha.1` | React/Cesium product-generation version; not the repository release semver |
| Canonical `apps/aethergrid-console/app.json` and `ui.json` | `4.0.0-alpha.1` | Application/UI contract version aligned to the promoted v4 web workspace |
| Native v3 compatibility source | historical v3 | Root `index.html` / `styles.css` / `app.js` are packaged under `legacy/`; they no longer define the primary app version |
| ÆTHERGRID JSON `schemaVersion` | `2` | Manifest schema shape, separate from app or repository version |
| Earlier `apps/operator-console/app.json` | `0.2.1` | Earlier evidence console manifest coupled to repository delivery by release-readiness |

## Next repository release decision

The next repository/package release candidate is **0.2.1** following canonical migration PR #148, tokenless Cesium city fix PR #159, and browser repair PR #160. The existing `v0.2.0` tag is immutable and must not be reused. Publication remains contingent on final exact-main verification and canonical live-provider evidence. The 0.2.1 patch captures the verified improvements and corrections since the already-published 0.2.0 milestone, without claiming a stable 1.0 contract. This does not declare a stable 1.0 API or validated quantum hardware.

Root package, lockfile and changelog now identify the same unreleased `0.2.1` candidate. The full-app packager derives its generated package version from the root package. The earlier evidence-console manifest intentionally follows repository delivery at `0.2.1`, as required by the maintained release-readiness contract; this does not promote it to the canonical interface. Canonical `app.json`, `ui.json` and the private React workspace remain aligned at `4.0.0-alpha.1`; manifest schema versions describe data shape, not release semver. Native v3 compatibility remains explicitly noncanonical.

Compatibility assessment: `npm run aethergrid-app` now builds and serves React at the backend origin, the ZIP launches that same build, missing builds fail visibly, and v3 direct-open HTML moves under `legacy/`. The prior 0.2.0 release and subsequent renderer/acceptance changes justify this pre-1.0 patch candidate; backend provider APIs and advisory boundaries are retained. This reconciliation creates no tag or GitHub release.

A final release report must name the exact main SHA, integrated PRs, package/runtime contract, all maintained gate results and sanitized live-provider artifact. No release should be created or published while canonical application migration or that final evidence is missing.
