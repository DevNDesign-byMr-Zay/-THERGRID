# Step 6 — specialist and TEAM frontend completion

The canonical specialist workspace uses the existing `GET /api/aethergrid/runtime`, `POST /api/aethergrid/agents/:id`, `POST /api/aethergrid/team` and returned-record evidence endpoints. VÆLON, AUREN, SOLVÆR and TEAM retain dedicated identities and advisory authority.

Backend model configuration is visible before execution, refreshes every minute while the AI workspace is active, and supports manual refresh. Failed refreshes preserve the previous configuration with a STALE label and its last-check timestamp. Missing or malformed fields remain unavailable. Configuration does not establish which model executed a task; that information comes from its execution receipt.

Operators can review any of eight retained local tasks per specialist. The selected task controls its response, actual model, contributions, captured entity/source/time context and exact returned-evidence action. Failed and stopped requests retain their context and error without inventing a response or receipt. Stopping waits locally; the server outcome remains unknown. Late responses cannot overwrite a newer task. History clears on reload. Scenario comparison navigation uses the current workspace, explicitly disclosed beside the captured task context.

## Current backend dependency

Main remains `9b61b86` on the 2026-10-14 inspection. Jules' backend branch `7a4715d` publishes auth/history contracts; those belong to the corresponding frontend workstreams. Branch `6d53c6a` adds an agent tool registry and MCP classes, but the HTTP server and agent runtime do not call or expose them. Agent responses have no tool-call or citation schema. Full step 6 therefore still requires authorized tool endpoints and response provenance/citations from Jules. The frontend explicitly shows this limitation and does not implement competing decisions or fabricate citations.

## Acceptance

Pure normalization and context/receipt tests failed before implementation, then passed5/5 with the existing specialist contracts. Compiled desktop/mobile task review, stale runtime configuration, exact old-task evidence navigation, failure history and controlled late-response acceptance passed6/6, including the two existing specialist browser cases and the full picked-building → AUREN → comparison → exact-evidence flow. The original two-second delayed-response fixture resolved before the slow software-GPU click; replacing the delay with a controlled response reproduced the actual missing STOPPED WAITING state. The first building-flow fixture was registered after the application had already prefetched New York; registering it before navigation restored the actual geometry assertion without a product change. Root tests initially failed two source-layout checks because of prop ordering; preserving the established ordering restored534/534 without changing assertions. TypeScript/build passed. Final polished captures and review/CI status are recorded in PR#171.

Actual screenshots: [step6-specialists](2026-10-14-step6-specialists/). Offline browser fixtures prove interaction and provenance separation; they do not prove live provider accuracy.

Decisions: use backend configuration separately from execution receipts (cost: operators review both); retain failed/stopped attempts locally with no receipt (cost: server outcome remains unknown); review old-task evidence while disclosing current-workspace comparisons (cost: comparisons do not restore past workspace state); hold tool/citation integration until a backend contract exists (cost: full step 6 remains dependent on that work).

## Independent review

Fresh read-only review of43dec214..edaf24a found no Critical, Important or Minor issues. The reviewer independently passed TypeScript and diff validation. Recommendations are future lifecycle coverage for active-panel refresh replacement and a different-specialist handoff during an active request; the inspected guards were sound. No second review or product fix was required. Live provider execution/accuracy, server cancellation, absent tool/citation contracts, auth/persisted server history/release and physical-GPU performance were explicitly outside this frontend extension. Their limits remain disclosed; those deferred verifications require backend/device evidence. Exact published-commit CI status is maintained in PR#171.
