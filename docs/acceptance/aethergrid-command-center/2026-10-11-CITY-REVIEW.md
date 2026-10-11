# City renderer review and verification boundaries

Independent read-only review of `4eb468b..a8d6a42` found no critical issues and two important findings:

1. Nonadjacent vertex-on-edge contact and adjacent backtracking were admitted. Regression tests reproduced the problem, then inclusive segment admission rejected both while retaining valid forward-collinear edges.
2. Compiled acceptance counted geometry without testing roof/body picking. Acceptance now clicks the central rendered fixture roof and facade, exports the real entity dossier and asserts feature identity, height category, roof refinement, mapped color and attribution. The first export exposed the existing 24-property cap dropping geometry metadata. A failing pure regression reproduced it; bounded exports now prioritize safe provenance fields, retaining the cap and secret filtering.

The reviewer declined to certify pending captures, external gates, live city accuracy, credentialed providers, physical-device performance and existing deferred fidelity features. No additional review loop was requested.

Follow-through browser acceptance exposed existing renderer-switch teardown defects in both `GeodeticGridLayer.destroy()` and `WeatherAtmosphereLayer.destroy()`: removal from an owning Cesium `PrimitiveCollection` destroyed the collection, followed by a second destruction. Failing regressions use Cesium's real collection with both `destroyPrimitives: true` and `false`; teardown now destroys only when still required and is idempotent, with weather restoring the original fog. Temporary switch diagnostics were removed. Both rendered roof and facade picks passed their dossier identity/provenance assertions before this independent switch failure.

Additional QA: native notices no longer cover the scene center (a compiled bounding-box regression failed before the CSS change). Fallback and selection are separate acceptance cases, avoiding a combined software-GPU timeout without reducing assertions. Facade picks use the visible wall at y=430 in the inspected captures; y=448 selected an occluding foreground feature in London and Tokyo. A renderer-level test asserts actual Cesium body/roof instance RGBA values and shared source identity. Provider receipts now retain the returned provider; dossiers label static building and city-geometry context MAPPED, not LIVE, with failing pure regressions for each provenance error.

The notice also overlapped city identity in the first relocated capture; a separate bounding-box regression reproduced that overlap and the final position avoids both surfaces. Offline geometry cases explicitly return unavailable for unrelated current-weather and city-live requests, making their scope deterministic and excluding changing cloud/precipitation workloads. Weather/live-source acceptance remains separate. Dossier export is keyboard-activated after visible, enabled and focused assertions; roof/facade picking remains actual pointer interaction.

The three-city fixtures are explicitly attributed **OFFLINE GEOMETRY FIXTURE — NOT CITY ACCURACY EVIDENCE**. They establish the renderer contract, not New York, London or Tokyo architectural accuracy. Missing or unsupported mapped attributes retain simple massing with visible limitations. Native rendering is explicitly a wireframe fallback, without facade/terrain detail.

Source semantics: [OSM Simple 3D Buildings](https://wiki.openstreetmap.org/wiki/Simple_3D_buildings) defines total height including roof and wall height as total minus roof height; [pyramidal roofs](https://wiki.openstreetmap.org/wiki/Tag%3Aroof%3Ashape%3Dpyramidal) converge to a single high point. Only positive explicit roof height on admitted convex footprints receives this refinement. OSM tags are mapped attributes, not surveyed measurements.

## Verified local checkpoint

The final TypeScript production build passed. All 15 compiled city/renderer acceptance tests passed (6.2 minutes, one worker): three-city roof/facade pointer picking, keyboard dossier export, provider/MAPPED state, roof RGBA and identity, geometry admission, native fallback/projection, obsolete arrivals and owning/non-owning teardown. The final full root check passed 534 tests with zero failures, 92.41% line / 75.15% branch / 94.78% function coverage and unchanged thresholds. The separate credential-free real-source globe/New York test passed (2.1 minutes). Exact-head external gates remain pending.

Actual inspected screenshots:

| Capture | Meaning |
| --- | --- |
| [New York fixture](2026-10-11-city-realism/fixture-new-york-cesium.png) | Offline renderer contract, not city accuracy |
| [London fixture](2026-10-11-city-realism/fixture-london-cesium.png) | Offline renderer contract, not city accuracy |
| [Tokyo fixture](2026-10-11-city-realism/fixture-tokyo-cesium.png) | Offline renderer contract; computed nighttime illumination is not measured window light |
| [Native wireframe](2026-10-11-city-realism/fixture-native-wireframe.png) | Actual native-WebGL massing/roof edges, with visible facade/terrain limitation |
| [Real-source New York](2026-10-11-city-realism/real-source-new-york.png) | 359 mapped buildings / 90.3% mapped height tags; map source timestamp September 30, not a current surveyed observation |

The strengthened native acceptance also passed separately (42.2 seconds), explicitly asserting an active, non-lost WebGL context rather than accepting the Canvas2D fallback.

Environment: Node 22.23.3, Chromium 153.0.8010.0, Linux cloud browser with ANGLE SwiftShader. This does not certify physical-device GPU performance, credentialed tiles, surveyed buildings or historical reconstruction. Existing night illumination badge/city-caption collision in the Tokyo capture remains a final visual-QA item; it does not affect rendered geometry or source picking.
