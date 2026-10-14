# City realism implementation plan

Approved scope: second frontend PR, stacked on the production foundation. Extend the canonical geometry rather than invent city landmarks or verified materials.

1. Add a pure geometry boundary for valid finite rings, source-tagged height categories and supported roof refinement. Reject invalid footprints and heights. Only explicitly tagged pyramidal roofs with positive roof height and convex footprints receive a pyramid; other tags retain massing with a limitation.
2. Build actual Cesium roof triangles with retained entity picking/provenance. Use mapped roof colors/materials when available. Native fallback displays corresponding 3D massing/roof edges and labels its wireframe limitation.
3. Derive height coverage from admitted buildings, separating explicit height tags, estimated tags, level-derived heights and modeled heights. Keep footprint/roof coverage and unsupported refinement counts visible. Do not treat OSM tags as a surveyed measurement.
4. Verify pure geometry rejection, closed/concave rings, roof total height, source categories and materials, then compiled city picking in New York/London/Tokyo fixtures. Fixtures certify geometry contracts only. Run build/root/browser gates and independent review. Retain actual screenshots and exact-head CI results.

Existing terrain/imagery, solar lighting, weather and adaptive SSE remain in their existing architecture. Credentialed tiles and physical-device performance must be separately verified; absent source attributes are explicitly limited. This PR is a bounded renderer improvement, not a declaration that every city realism requirement is complete.
