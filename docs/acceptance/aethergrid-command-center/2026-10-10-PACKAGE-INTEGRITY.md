# ÆTHERGRID canonical app integrity audit — 2026-10-10

## Evidence boundary

This is an audit of the actual CI-produced canonical application archive, not a claim of production deployment or live quantum hardware execution. The source baseline was `main` commit `c8fe882ecc6bd7b155d4865e6726efb574824ebf`.

- [Engineering CI source run](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38022243369)
- GitHub Actions artifact ID: `11658428480` (`aethergrid-functional-app-<SHA>`).
- The Actions artifact contained `aethergrid-functional-app.zip` (39,819,283 bytes before Actions compression).
- The source repository tree contained **370 tracked files**, with no zero-byte tracked files.

## Independently inspected canonical ZIP

The archive was downloaded from the exact source run, opened, hashed and extracted. Findings:

| Check | Observed |
| --- | --- |
| Archive entries | 1,297 |
| Files in `PACKAGE_CONTENTS.json` | 1,295 |
| Additional inventory and checksums files | `PACKAGE_CONTENTS.json`, `SHA256SUMS.txt` |
| Zero-byte entries | 0 |
| Duplicate or unsafe ZIP entries | 0 |
| Size/SHA-256 mismatches across all 1,295 payload entries | 0 |
| Bytes validated in payload inventory | 39,169,851 |
| Canonical built frontend JavaScript | `web/dist/assets/index-DkBxL45F.js` (4,737,558 bytes) |
| Cesium Worker assets | 110 |
| Canonical backend `server.mjs` | 86,739 bytes |

The archive contains the canonical compiled React/TypeScript and Cesium frontend, Node service, provider adapters, UI/app manifests, brand assets and legacy compatibility source. The older `aethergrid-operator-console.zip` is not the canonical product package.

The extracted release was launched locally using Node 22 and **no private provider secrets**. Backend syntax checks passed for the server, AI runtime, quantum runtime and D-Wave provider. HTTP `200` responses were observed from the application root, `/api/aethergrid/health`, `/api/aethergrid/config/public`, `/api/aethergrid/quantum/runtime`, and `/api/aethergrid/runtime/providers`.

These checks prove that the actual packaged backend runs and its local application/API boundaries respond; they do **not** establish that all external data sources are live, that a QPU job was executed, or that a production GPU/device/browser deployment has been accepted.

## Failure diagnosis and permanent regression gates

Protected run [38022761586](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38022761586) passed 17 browser tests, failed one mobile drawer focus test and skipped two tests intentionally. The credentialed provider stage was then skipped. Consequently no sanitized provider report existed; the artifact upload error was a *secondary symptom*, not evidence that source code files were missing.

A [diagnostic PR run](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38023303632) reproduced the failure and logged that the drawer was open, visible, non-inert and dialog-labeled, but focus remained on the external navigation toggle. The changed focus hook now waits until the opening drawer can actually take focus; a dedicated v4 Playwright gate catches regression.

The maintained packaged-runtime smoke now checks every extracted entry against the committed package manifest's size and SHA-256 digest, requires a genuine compiled frontend and Cesium Workers, and refuses missing, duplicate, empty, modified or unlisted files. Unit tests verify valid, tampered and malformed inventories.

The canonical workflow now produces a strictly non-release-eligible, credential-free failure diagnostic when acceptance stops before provider evidence can be collected. A failure report does not count as provider acceptance and never authorizes publication.

## Still required before `v0.2.1` publication

After the integrity PR merges, select the exact new `main` SHA and require successful Engineering CI and CodeQL push gates. Dispatch the protected `aethergrid/canonical-live` gate against that SHA. Inspect sanitized credentialed receipts (Groq agents and TEAM, Tomorrow.io, EIA, NOAA, Transitland, NYC Ferry, Cesium and configured IBM discovery); unavailable hardware must remain explicitly labeled and no hardware execution may be implied.

Only when the canonical run is green and evidence-bearing should the manual GitHub release workflow publish `v0.2.1` with `aethergrid-functional-app.zip`, its provenance manifest, SBOM and checksums.

Production hosting, paid quantum hardware submissions, and visual/gpu quality improvements remain distinct from this release-integrity lane.
