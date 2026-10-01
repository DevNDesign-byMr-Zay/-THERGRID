# ÆTHERGRID v4 web workspace

This directory is the additive, non-breaking migration lane for the v4 operator experience.

It intentionally does **not** replace `apps/aethergrid-console/index.html` or the verified v3 standalone package yet.

## Scope of this branch

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
npm install
npm run dev
```

The Vite development server runs on `127.0.0.1:5174` and proxies `/api` to the existing Node application on `127.0.0.1:8090`.

## Build

```powershell
npm run build
```

Cesium's required Workers, Assets, Widgets and ThirdParty directories are copied into the build output. The spatial adapter uses Cesium World Terrain and Cesium OSM Buildings when a configured token is available.

The existing native renderer remains the fallback target. Wiring the full v3 renderer bridge into this shell happens only after the new web workspace can be merged without regressing the verified v3 application/package.
