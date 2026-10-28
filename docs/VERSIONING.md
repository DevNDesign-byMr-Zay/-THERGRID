# Version scheme

Repository release semver and product generations identify different contracts. A product label must never choose the GitHub release tag automatically.

| Surface | Version | Meaning |
| --- | --- | --- |
| Root `package.json` and `package-lock.json` | `0.3.3` | Current unreleased repository/package candidate; release tags must match this source of truth |
| Latest published GitHub release | `v0.3.2` | Published October 26, 2026; remains the latest release until a new exact-main gated publication |
| ÆTHERGRID product generation | `v4` | React/Cesium command-center generation and its provider runtime work |
| Canonical `apps/aethergrid-console/web/` workspace | `4.0.0-alpha.1` | React/Cesium product-generation version; not the repository release semver |
| Canonical `apps/aethergrid-console/app.json` and `ui.json` | `4.0.0-alpha.1` | Application/UI contract version aligned to the promoted v4 web workspace |
| Native v3 compatibility source | historical v3 | Root `index.html` / `styles.css` / `app.js` are packaged under `legacy/`; they no longer define the primary app version |
| ÆTHERGRID JSON `schemaVersion` | `2` | Manifest schema shape, separate from app or repository version |
| Earlier `apps/operator-console/app.json` | `0.3.3` | Earlier evidence console manifest coupled to repository delivery by release-readiness |

## Next repository release decision

The repository/package candidate is **0.3.3**. The existing `v0.3.2` tag is published and immutable. This patch candidate captures offline-proof, Windows source portability, city-planning modularity and web dependency fixes after v0.3.2. The prior release remains available; the candidate must pass all exact-main gates before publication.

Root package, lockfile, earlier evidence-console manifest and changelog must remain aligned at `0.3.3`. Canonical React/Cesium `app.json`, `ui.json` and web workspace retain their independent product-generation version `4.0.0-alpha.1`; manifest schema versions remain independent of release semver.

The next release must pass the maintained engineering, security, full browser/sustained-replay, Windows, fresh-extracted ZIP, container and exact-main canonical-live gates on the **same integrated commit**. D-Wave hardware remains unavailable, Qiskit Aer is local circuit simulation only, and any IBM Quantum QPU job requires explicit separate authorization. An unsigned iOS project is not an installable IPA. Preparation creates no release tag or published artifact.

