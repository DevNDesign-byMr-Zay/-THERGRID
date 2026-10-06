# Version scheme

Repository release semver and product generations identify different contracts. A product label must never choose the GitHub release tag automatically.

| Surface | Version | Meaning |
| --- | --- | --- |
| Root `package.json` and `package-lock.json` | `0.1.3` | Current unreleased repository/package candidate; release tags must match this source of truth |
| Latest published GitHub release | `v0.1.2` | Earlier published milestone, not evidence that the current main has been released |
| ÆTHERGRID product generation | `v4` | React/Cesium command-center generation and its provider runtime work |
| Canonical `apps/aethergrid-console/web/` workspace | `4.0.0-alpha.1` | React/Cesium product-generation version; not the repository release semver |
| Canonical `apps/aethergrid-console/app.json` and `ui.json` | `4.0.0-alpha.1` | Application/UI contract version aligned to the promoted v4 web workspace |
| Native v3 compatibility source | historical v3 | Root `index.html` / `styles.css` / `app.js` are packaged under `legacy/`; they no longer define the primary app version |
| ÆTHERGRID JSON `schemaVersion` | `2` | Manifest schema shape, separate from app or repository version |
| Earlier `apps/operator-console/app.json` | `0.1.3` | Maintained earlier evidence console version |

## Next repository release decision

The selected next repository release target is **v0.2.0**, contingent on the canonical React/Cesium packaging migration and final exact-main verification. Promoting a new default UI and packaged application changes the pre-1.0 application delivery contract enough to warrant a minor milestone rather than an incidental patch. This does not declare a stable 1.0 API or validated quantum hardware.

Keep the root candidate at `0.1.3` until the canonical integration contract is landed and assessed. At release reconciliation, change root package/lockfile and the changelog candidate together to `0.2.0`; decide explicitly whether the earlier evidence-console manifest is coupled to repository delivery or retains its legacy version. Keep the v4 frontend/application generation distinct from repository semver, and keep the native v3 compatibility surface explicitly noncanonical. If the integration instead preserves delivery compatibility, record that evidence before revising the selected target.

A final release report must name the exact main SHA, integrated PRs, package/runtime contract, all maintained gate results and sanitized live-provider artifact. No release should be created or published while canonical application migration or that final evidence is missing.
