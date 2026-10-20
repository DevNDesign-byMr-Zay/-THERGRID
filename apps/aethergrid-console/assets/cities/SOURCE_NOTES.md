# Bundled district maps

These gzip JSON datasets contain mapped OpenStreetMap footprints and context
retrieved on 2026-10-20 through the official OpenStreetMap map API. Each source
record retains its fetch timestamp and upstream timestamp. The data is a dated
snapshot, never a live or historically reconstructed infrastructure observation.

© OpenStreetMap contributors. The derived geographic database is provided under
the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See [OpenStreetMap copyright](https://www.openstreetmap.org/copyright).
The adjacent city-snapshots-manifest.json records the cities, feature counts,
source receipts and SHA-256 of each decompressed JSON dataset.

Coverage is district-level around each declared coordinate. Ways may extend
beyond the requested bounding box. Completed multipolygon boundaries and courtyards are preserved; incomplete relations are withheld. Footprints, road paths, water and green areas
are mapped; building heights retain their explicit, levels-derived or inferred
classification. This is not a survey, a photogrammetric mesh, or a terrain survey.

The Earth image combines the NaturalEarthII tiles included in CesiumJS 1.145.0.
The original Cesium asset notices remain included in the full runtime package.
The standalone view uses an ellipsoid with mapped extrusions; remote terrain
and licensed photorealistic tiles still require their configured providers.
