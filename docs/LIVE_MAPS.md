# Live maps and spatial connections

The canonical Cesium workspace supports SOLID, WIREFRAME, GRID, XRAY, HOLOGRAPHIC, OPERATIONS and REALITY in both globe and city scope. Shared mapped buildings, courtyards, roofs, aircraft and radar retain their geographic coordinates when the visual style changes. Weather radar retains provider colors so its interpretation does not change with the style.

## Start and connect

Extract the full application ZIP and run `START-AETHERGRID.cmd` on Windows, or run `node server.mjs` with Node 22 from the extracted application directory. Open `http://127.0.0.1:8090/`. Account protection, when configured, remains enforced.

Opening root `index.html` directly loads the embedded globe engine and eight bundled district snapshots without a server. Public weather/radar still needs internet access. Aircraft providers reject requests from a local-file browser origin, so direct-open aircraft data uses the running loopback backend on port 8090. If that backend requires authentication, use the signed-in connected workspace. HTML cannot start Node automatically.

Only read-only health and aircraft routes allow the local-file origin on a loopback host. Profile, settings, account and mutation routes are excluded. No generic third-party CORS proxy is used.

## Aircraft

- City/coordinate scope uses ADSB.lol within 250 km by default (maximum 250 nautical miles). Receiver coverage varies; absence of aircraft does not establish empty airspace.
- Global scope uses OpenSky's states endpoint. Anonymous upstream refresh is at most once every 15 minutes to respect its daily request budget. Optional OAuth refresh is two minutes. The browser checks the backend every 30 seconds; cached observations retain their original timestamps.
- Set `AETHERGRID_OPENSKY_CLIENT_ID` and `AETHERGRID_OPENSKY_CLIENT_SECRET` on the server for OAuth. Neither is embedded in the browser bundle; private tokens remain on the server. Existing cache/quota limits still apply.
- Aircraft have observation timestamps, real returned positions, heading, altitude and provider attribution. Missing coordinates are rejected. Recent consecutive fixes interpolate over one second; delayed observations do not animate as fresh positions. The renderer does not extrapolate invented flight paths.
- Global display is geographically distributed and capped at 2,400 aircraft; city display is capped at 1,000. Feed counts and displayed counts are separate. Trails are retained only for current aircraft, with a bounded 300-aircraft trail budget.
- Use **Focus observed aircraft** for a camera approach and **RETURN TO VIEW** to restore the selected city/globe target. Aircraft models are embedded so the direct-open package has no missing model URL.
- Source age over two minutes or upstream failure is explicitly marked delayed. Dated cached results can remain visible for up to 30 minutes on provider failure. No replacement traffic is generated.

## Radar and weather

RainViewer provides up to 13 observed composite radar frames, generally at ten-minute intervals. The player advances between returned frames, with play/pause, a frame slider, coverage toggle and frame time. Reduced-motion preferences start playback paused. The manifest refreshes every five minutes; tile requests use the provider's public tile host and maximum zoom 7. At most three radar frame layers plus one coverage layer are retained.

Coverage is partial. No echo is not evidence of clear weather; composite/frame time is not an instantaneous street-level measurement. Radar older than 30 minutes is marked stale. Connection and tile errors are disclosed, preserving the base map. Recent radar and aircraft layers hide outside LIVE temporal mode; forecast weather uses the existing separately labeled forecast pipeline.

City weather continues to use the configured weather service and source-driven atmospheric presentation. Global radar is precipitation coverage, not a worldwide street-level weather reconstruction. Native renderer failover preserves supported vector overlays; the raster radar layer requires Cesium.

## Terrain and photorealistic Reality

The tokenless globe and bundled city massing work without a Cesium account. **Settings → Developer → Live map connections** can check current feeds and apply a read-only, asset-scoped Cesium ion public browser token. Token changes reconnect the renderer. Private service credentials do not belong in that field.

REALITY uses accessible photorealistic 3D Tiles when the account/provider authorizes them. Saving a token does not prove acceptance or asset entitlement. The renderer reports degraded/unconfigured Reality when it cannot obtain those assets. Mapped district snapshots remain available across visual modes, but their inferred heights and simplified massing are not surveyed 1:1 replicas or complete cities.

## Providers and verification

Primary provider documentation:

- ADSB.lol: https://api.adsb.lol/api/openapi.json (ODbL; discuss production use with provider).
- OpenSky: https://openskynetwork.github.io/opensky-api/rest.html (coverage, credit limits and OAuth rules apply).
- RainViewer: https://www.rainviewer.com/api/weather-maps-api.html (attribution required; public service for personal/educational/small community use; arrange provider permission for production use).

Automated checks cover normalization, null coordinates, units, OAuth token handling, cache freshness/backoff, invalid input, HTTP routes, loopback CORS scope, embedded aircraft assets, bounded radar layers, temporal gating, public token persistence and the compiled globe/city visual-mode matrix. Fixture browser tests prove interaction and rendering contracts; they do not prove real-world map accuracy or provider availability. The offline suite opens the actual packaged HTML with network requests blocked.
