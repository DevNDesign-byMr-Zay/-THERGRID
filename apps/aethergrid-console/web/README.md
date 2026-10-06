# ÆTHERGRID v4 canonical web workspace

This directory is the **canonical ÆTHERGRID operator application**. React + TypeScript + Vite own the product shell, CesiumJS is the primary spatial renderer, and the native renderer remains a verified fallback behind the shared spatial contract.

The production Node server serves this workspace's built `dist/` output at the application root. The old root native-v3 HTML/CSS/JavaScript is compatibility source only and is packaged under `legacy/`, never as a competing primary interface.

## Canonical scope

- React + TypeScript + Vite application shell
- CesiumJS production renderer adapter
- native-WebGL compatibility adapter
- automatic Cesium-to-native failover manager
- shared spatial renderer contract
- LIVE / HISTORICAL / FORECAST / SCENARIO temporal model
- synchronized 4D playback clock
- temporal layer registry/sampling contract
- provider-backed FORECAST weather cursor sampling
- live NWS active-hazard visualization using returned source geometry when present, with point-context markers only when the provider omits polygon geometry
- explicit per-city NOAA NWPS gauge and EIA region bindings stored as non-secret operator settings
- provider Connection Center driven by the safe `/api/aethergrid/runtime/providers` contract
- source-backed GTFS-Realtime vehicle-position overlays with no inferred route geometry
- source-backed NOAA NWPS gauge markers only when the provider supplies valid coordinates
- latest-period EIA fuel-mix visualization using provider values/units without invented regional polygons
- explicit D-Wave annealing workspace with solver discovery, encoded problem input, double operator confirmation, genuine problem-ID polling and provider-returned results
- responsive operator shell and timeline

## Boundary with the provider-foundation work

This workspace consumes safe public configuration through:

`GET /api/aethergrid/config/public`

but does not define that server route.

Configuration, provider registry, secret handling, cache, rate limits, circuit breakers and server provider health remain outside this lane so that the backend-foundation branch can merge independently.

For isolated development only, a restricted Cesium public-client token may be supplied as:

`VITE_AETHERGRID_CESIUM_ION_TOKEN`

Production should prefer the server-generated public configuration contract. Never expose IBM Quantum, AI, Tomorrow.io, D-Wave, EIA or other private credentials through Vite/browser environment variables.

Operational source bindings are identifiers, not credentials. The browser may persist an operator-verified NOAA NWPS gauge ID or EIA balancing-region code per city/coordinate, but the UI never infers those identifiers from map position and never stores the corresponding provider secret.

NWS active hazards remain LIVE-only. Polygon or MultiPolygon geometry returned by the provider is rendered as source boundary geometry. If the point query returns an active alert without geometry, ÆTHERGRID shows only a marker at the queried coordinate and does not fabricate an affected-area polygon or radius.

## Local development

From this directory:

```powershell
npm ci
npm run dev
```

The Vite development server runs on `127.0.0.1:5174` and proxies `/api` to the existing Node application on `127.0.0.1:8090`.

## Build

```powershell
npm run build
```

## Command-center acceptance

The product navigation exposes GRID, GLOBAL, HOLOGRAPHIC, QUANTUM, AI and EVIDENCE, with SCENARIOS and SETTINGS as secondary destinations. The left rail selects one navigation workspace; the right rail selects one intelligence workspace or inspector. Mobile and tablet use keyboard-contained drawers with Escape dismissal and focus restoration. The page stays within the viewport; long histories and inspector content use bounded internal scrolling.

Canonical product and agent artwork is bundled from `../assets/brand`. `dashboard-reference.webp` is not a runtime background. At the activation baseline that reference cannot be decoded; a replacement is needed for exact visual comparison.

Run the real backend-connected browser suite:

```powershell
npm ci
npx playwright install chromium
npm test
```

The suite starts the existing Node backend and Vite proxy. The backend loads `../.env.secrets` when present, which remains ignored by Git. Tests never submit hardware jobs. A managed environment with an existing Chromium binary may set `AETHERGRID_TEST_CHROMIUM` to its absolute path; software rendering in that configuration verifies layout and fallback behavior, not GPU performance or Cesium ion activation.

To check the compiled build against the same backend in PowerShell:

```powershell
npm run build
$env:AETHERGRID_TEST_BUILT = "1"
npm test
Remove-Item Env:AETHERGRID_TEST_BUILT
```

`vite preview` remains a local build-acceptance surface. Production uses `../server.mjs`, which serves the compiled `dist` output and the same-origin `/api/aethergrid/*` contracts.

Tested layout sizes: 1536×1024, 1440×900, 1366×768, 1024×768, 768×1024 and 390×844. Screenshots and the JSON test report are written to ignored `test-results/`.

The Connection Center reports backend readiness separately from successful source requests. `CONFIGURED` and `READY` do not establish live-provider validation. Agent replies preserve provider/model provenance and TEAM specialist contributions. Source timestamps, forecast/scenario labels and hardware-submission confirmation remain in their existing runtime contracts.

Cesium's required Workers, Assets, Widgets and ThirdParty directories are copied into the build output. The spatial adapter uses Cesium World Terrain and Cesium OSM Buildings when a configured token is available.

The typed native renderer remains the fallback target inside the canonical v4 shell. The historical v3 standalone surface is retained separately under `legacy/` for offline compatibility and regression comparison.


## Provider-backed operator integration boundary

The v4 operator surface now consumes the merged production provider runtime rather than implementing provider credentials in the browser.

- Tomorrow.io forecast data is consumed from the backend's normalized `timesteps` contract. Legacy `timelines.hourly` remains a compatibility fallback, while provider-specific Tomorrow weather codes are not promoted into Open-Meteo code semantics.
- NWS alerts render provider-returned Polygon/MultiPolygon boundaries when present. Missing geometry produces a point-context marker only.
- GTFS-Realtime vehicle positions render only decoded source coordinates. ÆTHERGRID does not infer route lines, interpolate missing vehicle positions, or label undecoded/fallback feeds as live.
- NOAA NWPS gauge geometry appears only when a manually bound gauge returns valid latitude/longitude. Flood bands are derived from provider observed stage and provider action/minor/moderate/major thresholds.
- EIA fuel-mix rows remain operational data, not spatial geometry. Region polygons are not invented from a balancing-region code.
- D-Wave submissions require an explicit solver, supported problem type, actual encoded provider payload, an operator checkbox, and a second confirmation. “Hardware executed” appears only after the provider returns a completed answer.

The Connection Center reports safe server-side readiness metadata. It never renders API keys, bearer tokens, SAPI tokens, IBM credentials, EIA keys, or private provider URLs containing credentials.
