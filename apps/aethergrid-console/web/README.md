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
- responsive operator shell and timeline

## Boundary with the provider-foundation work

This workspace consumes safe public configuration through:

`GET /api/aethergrid/config/public`

but does not define that server route.

Configuration, provider registry, secret handling, cache, rate limits, circuit breakers and server provider health remain outside this lane so that the backend-foundation branch can merge independently.

For isolated development only, a restricted Cesium public-client token may be supplied as:

`VITE_AETHERGRID_CESIUM_ION_TOKEN`

Production should prefer the server-generated public configuration contract. Never expose IBM Quantum, AI, Tomorrow.io, D-Wave, EIA or other private credentials through Vite/browser environment variables.

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
