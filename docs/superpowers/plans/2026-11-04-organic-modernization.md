# Organic modernization implementation plan

**Goal:** Resolve the failing main browser gate and extract cohesive responsibilities from oversized application modules while preserving supported behavior.

**Baseline:** Upstream `0404ec101c27ef288a1d172943fe6f8e718d03f3`, tree `2433376e271268fc85676044c5f1724514d0b3ee`. Node 22: 704 tests pass. Engineering CI and CodeQL pass. Canonical browser shard 2 fails the global renderer usability test at 45 seconds. No active branch protection/ruleset exists; enforcement is an administrator prerequisite for protected integration.

**Spec:** User-supplied `upload/Pasted text(10).txt` in the current workspace. Assessment numbers remain outside source.

**Constraints:** Preserve APIs, agent/quantum safety boundaries, real-source provenance, direct-open HTML and Windows distribution. No timeout inflation, fabricated activity, broad rewrites, dependency churn, or weakened gates. Existing releases remain intact.

1. Diagnose the failing global-renderer test from its archived screenshot/context; reproduce on the maintained browser configuration. Fix the responsible boundary and prove it with the original acceptance test.
2. Extract native renderer geometry/environment/drawing responsibilities into focused modules with direct behavioral tests; preserve camera, lifecycle, reduced-motion and resource cleanup contracts.
3. Extract backend route families into bounded modules. Preserve authentication, body limits, error redaction, quota enforcement, evidence and provider behavior. Test actual HTTP requests and failure cases.
4. Extract cohesive legacy renderer/application and React navigation/timeline responsibilities. Preserve initialization, script/inlined ZIP order, memoization, cancellation and scene identity. Test each boundary before extraction.
5. Reconcile environment scanner edge cases, per-module debt owners/resolution, architectural map, and independently locked dependency evidence. Track every residual exception with a concrete owner and issue.
6. Run full Node/coverage/offline/JUnit/static/build/package checks; obtain independent code review; open a focused PR and request legitimate repository review. Integrate only after the maintained gates and required reviews pass. Revalidate resulting main before release or reassessment.

**Review focus:** Async initialization during renderer changes; request cancellation after city/mode changes; classic-script and archive dependency order; API error/authentication parity; geometry and weather parity under reduced motion.
