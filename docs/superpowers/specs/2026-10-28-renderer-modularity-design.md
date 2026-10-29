# ÆTHERGRID score-recovery continuation — 2026-10-28

## Purpose

Continue the merged October 27 score-recovery work and PR #209 without repeating it. The latest documented external baseline is 60/C, not a new rescore. The remaining requested improvements are renderer palette maintainability and oversized-file decomposition before a fresh assessment.

## Approaches

1. Documentation-only score evidence would be low-risk but leave the actual file-size and palette coupling untouched.
2. **Focused behavior-preserving extractions (selected):** move native and Cesium palette rules behind small pure modules; extract city defaults/search and stateless live source badges from the 2,997-line `App.tsx`. Retain the existing fallback and source-truth behavior with regressions.
3. A broad rewrite of the entire renderer and application shell could reduce line counts faster, but presents unnecessary Cesium, React state, timing and browser regressions in a single review.

## Constraints and acceptance

- Keep existing color values, transparency, source-backed labels, event handling, and controls unchanged.
- No invented hazard boundary, provider status, hardware execution, or score; physical actuation remains out of scope.
- Preserve TypeScript and Vite build, Node 22 compatibility, root CI/coverage/security gates, and the Windows PowerShell startup path.
- Add behavioral tests before each extraction, witness their failure, then pass focused and broad checks.
- Work in an isolated local branch, with no deployment, direct `main` write, or automatic merge.
- Browser visual acceptance requires a working browser and must be reported separately from static build/typecheck results.

## Done when

The new modules have focused regression tests, the two oversized entry files are measurably smaller, baseline and final test counts are recorded against exact SHAs, and remaining score or Opera-browser blockers are documented without claiming a new assessment score.
