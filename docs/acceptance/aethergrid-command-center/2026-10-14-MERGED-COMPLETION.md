# Merged frontend and final specialist/runtime acceptance

PRs #166, #167, #169, #170 and #171 were merged into main in dependency order on October 14, 2026 UTC (October 13 in New York). Main `0a747f95925d727d27b2cd8b4a9917df93260b5b` has tree `780800a487ea2edebf92884ededc828520f4ecca`, exactly the source tree verified for the final specialist PR. Earlier acceptance documents describe their inspection dates; their statements about draft/unmerged status are superseded by this report.

The source tree's PR acceptance passed 128 checks and a separate actual fifteen-minute modeled replay. Exact merged-main Engineering CI [38503868727](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38503868727) and CodeQL [38503868732](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38503868732) passed. Superseded intermediate merge candidates correctly failed the canonical-live SHA guard; those runs did not execute acceptance and are not counted as product failures or passing tests. Final-commit acceptance status and artifacts are recorded in the follow-up PR, rather than attributing prior results to new source.

## Final runtime correction

The actual local model runtime returns `provider: local` with `fallbackUsed: false` when local is the configured provider. The frontend previously called that a PROVIDER RESPONSE. Both task state and TEAM contributions now use the same classification: local provider or backend fallback flag means LOCAL FALLBACK. The response and execution receipt remain the exact returned backend values. No provider adapter, authentication service or packaging code changed.

A pure regression and compiled browser acceptance each failed with the wrong PROVIDER RESPONSE label before the correction. After the correction, six pure specialist tests and two compiled desktop/mobile runtime cases passed (eight total, 31 seconds). Production TypeScript/build passed. Root tests passed 534/534, zero failures, cancellations or skips. Screenshots are in [2026-10-14-merged-runtime](2026-10-14-merged-runtime/).

These new browser tests call the real canonical GET runtime, POST TEAM and GET evidence endpoints. The three specialist contributions, SHA-256 execution receipt and returned evidence are not mocked. Tests refuse to submit if any specialist is configured for an external model. Unrelated spatial/data feeds are explicitly unavailable during this focused runtime test. The desktop case disconnects the browser, verifies STALE configuration and failed task without evidence, reconnects, refreshes and completes a new real request without reloading. Actual execution is the local advisory engine, not live hosted-model verification.

## Last two batches: implementation and verification boundaries

| Requirement | Verified result / remaining dependency |
| --- | --- |
| Dedicated specialists, model configuration, contributions, readable explanations | Functional frontend and existing canonical runtime; local/provider/fallback states explicit. |
| Selected entity → AUREN → scenario comparison → exact evidence | Existing compiled source-picking acceptance passes; operator must submit the request. |
| Task history and failed/stopped review | Eight local records per specialist, cleared on reload; server cancellation unavailable. |
| Authorized tools and citations | Main HTTP server and AI runtime expose no tool execution or citation response contract. Jules' branch `6d53c6a` has registry/MCP classes, not callable agent HTTP integration. No invented frontend tool decisions or citations. |
| Desktop/tablet/mobile, keyboard, reduced motion, Cesium/native fallback, failed API requests | Existing focused browser matrix and actual screenshots; final follow-up CI reruns the matrix and real-runtime recovery cases. |
| Sustained replay and resource/frame measurements | Actual fifteen-minute compiled replay, JS heap, canvas/DOM, context-loss and browser scheduling telemetry. rAF intervals are not GPU FPS. |
| Physical-device GPUs and credentialed full-city tiles | Cannot certify from cloud Chromium/SwiftShader. Existing evidence does not establish physical desktop/mobile or sustained full-city tile performance. |

## Backend contracts inspected before further integration

The unmerged backend branch `7a4715d` is not acceptable as verified authentication or persisted history in its current form:

- `security/auth-manager.mjs` seeds a known local operator session. The session route returns `authenticated: true` and substitutes that session when the request has no valid token. Role selection is accepted from login input. This is not verified access control.
- `city-environment-runtime.mjs` constructs historical values with sine/cosine functions and fixed pressure, then marks the receipt `live: true`, `fallback: false`, attributed to persisted observations. Those values are generated simulation, not source-backed timestamped history.

The authorized frontend scope excludes rewriting those services/providers. Neither branch was merged as part of the five frontend PRs. Authenticated login/logout/roles, genuinely persisted observations, and agent tool/citation responses still require corrected server contracts. Historical views continue to expose unavailable data rather than silently using current or fabricated observations. D-Wave stays on hold and non-executable in frontend controls; IBM's existing abstraction is preserved.

Mapped building attributes and modeled presentation remain distinct from surveyed landmark/PBR fidelity. The overall mission is not certified complete while the backend and device/source evidence requirements above are unmet. The five requested frontend merges are complete; release packaging and publishing remain unchanged.

## Final review and existing runtime regressions

Fresh independent read-only review of the bounded local-label correction found no Critical, Important or Minor findings. It independently passed TypeScript and diff validation. Backend evidence records retain their pre-existing server-supplied VERIFIED status; that status does not establish factual accuracy of local advisory output, as the specialist receipt disclosure explains.

Automated PR review additionally identified two existing `command-center.spec.ts` assertions that expected PROVIDER solely from `fallbackUsed: false`. Both were reproduced failing against the corrected local runtime. Their assertions now include the returned local provider classification; all receipt/provider/contribution checks remain. The two existing real-runtime cases then passed2/2 in31.3seconds. CI explicitly runs these cases as well as the two new desktop/mobile recovery cases. No production implementation change was needed for this review finding. Six pure and four compiled specialist/runtime cases have passing results across the focused runs. Full follow-up CI, timed replay and merged-main status are recorded in the PR.


## Full merged-main acceptance deadline

The initial full canonical-live run [38504057653](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38504057653) on main0a747f9 was canceled at its thirty-minute job limit after reaching case123, with no failing test cases logged before cancellation. Its two earlier credential-dependent cases were skipped; this interrupted run is not counted as a passing suite. The expanded sequential browser suite outgrew the existing limit; the remaining tests and credentialed checks never completed. The job deadline is now sixty minutes, retaining the entire suite, workers=1, exact-main SHA checks, Engineering/CodeQL prerequisites and credentialed acceptance. Test timeouts and assertions are unchanged. This extends acceptance execution time only; it does not change provider adapters, authentication or packaging behavior. Final merged-main status remains recorded in the PR.
