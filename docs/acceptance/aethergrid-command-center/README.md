# ÆTHERGRID command center acceptance — 2026-10-04

Base: `ab644bc478883f873976cb9629ed94abac78924f` (main; engineering CI and CodeQL green when inspected). Branch: `feat/aethergrid-branded-command-center`. PR is a draft because credential-backed production activation is incomplete. No merge, deployment, or quantum hardware submission was performed.

## Frontend result

Canonical ÆTHERGRID, AUREN, VÆLON, and SOLVÆR assets restored. The shell fits the viewport, with exclusive navigation and intelligence workspaces, dedicated secondary inspectors, responsive drawers, keyboard focus containment/restoration, and reduced-motion styles. Spatial tools remain available through a compact renderer-tools disclosure. Agent requests show actual provider/fallback metadata; TEAM retains all three real contributions. Provider readiness is explicitly distinguished from live verification. Generated fallback city geometry is withheld rather than presented as mapped evidence.

The exact resolutions exercised are **1536×1024, 1440×900, 1366×768, 1024×768, 768×1024, and 390×844**. Automated assertions check `document.documentElement.scrollHeight <= innerHeight`, `document.body.scrollHeight <= innerHeight`, and body width <= viewport width at all six sizes. At 1536×1024, both initial rail content surfaces have at most one pixel of rounding overflow. The stage occupies over 45% of desktop width and over 50% of viewport height. Mobile tools may scroll horizontally inside their bounded toolbar; the page does not scroll.

The existing tracked Cesium screenshots show the earlier degraded run. A later credentialed headless acceptance run passed globe and city descent with HTTP 200 terrain, Bing imagery, and 17 building tiles from Cesium Ion; the newer screenshots were not retained after an execution-workspace reset. Source tiles do not establish OSM city identity; the mapped-identity panel remains pending. A pending badge is not a live-provider assertion.

## Runtime evidence

Checks used the real application server and provider APIs. Timestamps describe each check, not guaranteed future availability. Sanitized receipts and metadata are in [provider-activation.json](provider-activation.json).

| Capability | Observed result | Remaining requirement |
| --- | --- | --- |
| Cesium | Authenticated terrain endpoint HTTP 200, type TERRAIN. Engine initializes. Packaged terrain JSON, JPEG and worker paths pass their actual HTTP content checks after fixing static-copy paths. | Later full globe/descent acceptance passed with trusted managed CA and correct proxy loopback bypass, including Cesium terrain, Bing imagery and 17 Ion building tiles. The currently tracked Cesium screenshots are from the earlier degraded run; source-backed OSM identity still awaits Jules-owned retrieval. |
| Tomorrow.io | Current and 120 hourly forecast records returned live receipts at 11:51 UTC. Frontend current weather now uses the maintained selected-provider route and converts Tomorrow units and code semantics. | Set Tomorrow as the runtime provider for deployment; the default baseline remains Open-Meteo. Forecast is modeled, never labeled observation. |
| EIA | NYIS returned live electricity mix at 11:51 UTC. The existing OPS panel accepts explicit NYIS binding and shows source receipts and fuel mix. | Production selection is an operator binding; no regional mapping is inferred from a city coordinate. |
| Transitland | Authenticated geographic feed query centered on Midtown, radius 15km: HTTP 200, 10 real New York-area feeds at 11:06 UTC. Initial text search returned zero. | Jules-owned backend discovery integration and verified realtime vehicle-feed registry. Static-feed discovery does not validate realtime vehicles. |
| Direct GTFS-Realtime | NYC Ferry publisher endpoint returned HTTP 200 protobuf with one decoded geographic vehicle position and fresh feed timestamp near 12:03 UTC. A verified single-feed config is tracked and selected by ignored local runtime env. | The complete server-backed OPS/browser pass was not retained; feed availability and Jules-owned registry freshness semantics need independent verification in deployed runtime. |
| AUREN / VÆLON / SOLVÆR | Actual application POSTs HTTP 200 at 10:53 UTC, provider openai-compatible, model openai/gpt-oss-20b, fallbackUsed false, request IDs and receipts retained. | Groq availability remains subject to account rate limits. |
| TEAM | Actual application POST HTTP 200 with three real specialist contributions. Initial run hit Groq's 8000 tokens/minute limit and truthfully reported partial fallback. | Fresh-quota retest at 11:26 UTC passed: TEAM synthesis and all three specialist contributions used Groq, fallbackUsed false. Rate limits can still cause later requests to fall back. |
| Open-Meteo weather / forecast / AQI | Real server/browser retrieval succeeded. Latest UI screenshots show weather and CAMS model-time provenance. | Forecast and CAMS values are modeled data, not direct observation. |
| USGS / NWS / elevation | Earlier real API checks succeeded, including zero nearby seismic events and zero active NWS alerts. DEM retrieved separately. | DEM success is not Cesium terrain validation. |
| NOAA NWPS | The Battery gauge BATN6 returned live NOAA stage 2.5 ft, forecast stage 6 ft, and MLLW attribution at 11:51 UTC. The UI accepts explicit BATN6 binding and withholds missing flood thresholds and the `-999` flow sentinel. | This is a harbor gauge point, not a flood extent or an inferred city binding. |
| IBM Quantum | API key installed. Read-only IAM exchange returned HTTP 405, text/html; account UI was unavailable in the cloud browser. Instance discovery could not continue. | Verified account instance/service CRN and successful backend discovery. No CRN invented or paid instance created. |
| Local quantum | Actual Bell simulator request; local provider, no hardware execution. | IBM and D-Wave remain separate paths; no hardware job submitted. |
| D-Wave | Credential unavailable. | D-Wave token, safe discovery first. |
| OSM geometry | Default Overpass retrieval returned local fallback after too few real footprints. A documented alternate public instance timed out during a later check. | Generated city buildings are withheld. Jules-owned source retrieval needs successful real footprints. |

## Secrets and activation

All six supplied credentials are saved in encrypted GitHub **repository Actions secrets**. The authenticated table confirmed these names; the Groq value was replaced with the exact supplied value and GitHub displayed “Secret updated” at approximately 11:24 UTC. [Names-only proof](repository-secret-names.jpg) contains no values.

- `AETHERGRID_OPENAI_API_KEY` — supplied Groq key
- `AETHERGRID_CESIUM_ION_TOKEN`
- `AETHERGRID_TOMORROW_IO_API_KEY`
- `AETHERGRID_EIA_API_KEY`
- `AETHERGRID_TRANSIT_API_KEY`
- `AETHERGRID_IBM_QUANTUM_API_KEY`

`AETHERGRID_IBM_QUANTUM_SERVICE_CRN` remains absent because no verified real instance was obtained. The ignored local runtime file is mode 600 and was used for authorized checks. No credential value is in committed source, acceptance JSON, screenshots or this report. GitHub Actions secrets do not automatically inject credentials into a deployed application; production runtime wiring remains a separate activation step.

## Activation fixes

A real Groq response rejected the unsupported `context` property on a chat message. The narrow OpenAI-compatible transport fix sends only `role` and `content`; spatial context remains embedded in the existing system message, and local fallback retains its rich context. The regression fake provider rejects unsupported message properties and failed before the fix, then passed after it. Ollama and provider adapters are unchanged.

Vite static-copy v4 retained the full package path beneath `/cesium`, causing terrain JSON, sky textures and worker URLs to return HTML. `rename.stripBase: 5` now preserves paths relative to each Cesium asset group. Actual HTTP content checks guard the three resource classes. The drawer test scopes exclusive modal counting to the workspace drawers because Cesium retains a hidden attribution dialog in the DOM.

## Follow-up integration

The Connection Center now separates local quantum simulation from IBM and D-Wave configuration, and explicitly marks server health fields UNKNOWN when the readiness contract omits them. `verified-gtfs-feeds.json` holds the NYC Ferry publisher endpoint without credentials; the ignored local runtime config selects it. A real publisher response contained one position, but production configuration must use its own runtime secret injection and monitoring. The OPS binding panel accepts the independently verified BATN6 gauge and NYIS EIA region. Neither identifier is silently assigned to every city.

No IBM service CRN was found, no D-Wave token was supplied, and no paid quantum hardware job was submitted. The deployment target and production runtime secret injection remain unspecified, so this report does not claim a live hosted deployment.

## Verification and limits

The committed browser suite covers six viewport sizes, exclusive workspaces, inspector-to-analysis handoff, real TEAM and individual agent responses, ready canvas/provenance, local quantum, and responsive keyboard/drawer containment. It guards quantum acceptance so hardware providers are never submitted through this test. Development and compiled Vite preview runs are separate; the preview uses the existing API proxy. The repository's production server still serves its maintained existing console; this change does not claim a deployed v4 frontend.

Root repository tests, lint, typecheck, strict renderer typecheck, applicable Prettier check, web typecheck, and web production build were run. **474/474 root tests, 14 compiled-preview browser tests, and the three new isolated weather/NOAA regression tests passed. The opt-in Cesium source suite later passed both globe/descent and static-resource tests after local trust/proxy repair.** The earlier frontend run passed 12 development browser tests. The two targeted AI adapter regression tests also passed. Tests ran under Node 24.19.0 in the managed runtime; the repository requests Node 22. GitHub engineering CI, CodeQL, and the v4 web build subsequently passed at activation commit `2af2f9e94b6e4f66a52462f5b6f303ea4c6c3085`, including the Node 22 web workflow. Browser checks used headless Chromium with SwiftShader; no native GPU or cloud-browser production acceptance is claimed. The Cesium bundle still triggers the existing large-chunk warning.

The dashboard reference WebP in the repository is corrupt and cannot be decoded; canonical brand assets decode correctly. A valid reference is needed for pixel-level reference comparison.

Backend follow-up for Jules: expose source-backed Transitland discovery results and verify the NYC Ferry registry binding in the deployed environment; recover real OSM footprints; provide safe per-provider live-verification timestamps, request duration, cache age and fallback/error metadata (including Tomorrow/Transitland). Current readiness summaries alone cannot prove those capabilities live. The frontend consumes existing contracts; the proven OpenAI chat transport contract and weather/operational consumers were corrected. Provider adapters, IBM, D-Wave and registry internals are unchanged.

## Captures

- [command-center-1024x768.png](command-center-1024x768.png)
- [command-center-1366x768.png](command-center-1366x768.png)
- [command-center-1440x900.png](command-center-1440x900.png)
- [command-center-1536x1024.png](command-center-1536x1024.png)
- [command-center-390x844.png](command-center-390x844.png)
- [command-center-768x1024.png](command-center-768x1024.png)
- [global-renderer-1536x1024.png](global-renderer-1536x1024.png)

- [cesium-global-1536x1024.png](cesium-global-1536x1024.png) — earlier degraded capture; later source acceptance passed without a retained screenshot
- [cesium-city-1536x1024.png](cesium-city-1536x1024.png) — earlier degraded capture; later Cesium building tiles passed, OSM identity pending
- [repository-secret-names.jpg](repository-secret-names.jpg) — six encrypted secret names
