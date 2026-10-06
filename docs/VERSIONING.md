# Version scheme

Repository release semver and product generations identify different contracts. A product label must never choose the GitHub release tag automatically.

| Surface | Version | Meaning |
| --- | --- | --- |
| Root `package.json` and `package-lock.json` | `0.1.3` | Current unreleased repository/package candidate; release tags must match this source of truth |
| Latest published GitHub release | `v0.1.2` | Earlier published milestone, not evidence that the current main has been released |
| ÆTHERGRID product generation | `v4` | React/Cesium command-center generation and its provider runtime work |
| Private web workspace package and lockfile | `4.0.0-alpha.1` | Internal frontend package generation; not the repository release semver |
| Legacy `apps/aethergrid-console/app.json` and `ui.json` | `3.0.0` | Native-WebGL console app/visual contract version; the prior UI value `2.9.1` was stale |
| Legacy console JSON `schemaVersion` | `2` | JSON schema shape, separate from app version |
| Earlier `apps/operator-console/app.json` | `0.1.3` | Maintained earlier evidence console version |

## Next repository release decision

The selected next repository release target is **v0.2.0**, contingent on the canonical React/Cesium packaging migration and final exact-main verification. Promoting a new default UI and packaged application changes the pre-1.0 application delivery contract enough to warrant a minor milestone rather than an incidental patch. This does not declare a stable 1.0 API or validated quantum hardware.

Keep the root candidate at `0.1.3` until the canonical integration contract is landed and assessed. At release reconciliation, change root package/lockfile and the changelog candidate together to `0.2.0`; decide explicitly whether the earlier evidence-console manifest is coupled to repository delivery or retains its legacy version. Keep the private web generation and legacy console contract versions independently labeled. If the integration instead preserves delivery compatibility, record that evidence before revising the selected target.

A final release report must name the exact main SHA, integrated PRs, package/runtime contract, all maintained gate results and sanitized live-provider artifact. No release should be created or published while canonical application migration or that final evidence is missing.
