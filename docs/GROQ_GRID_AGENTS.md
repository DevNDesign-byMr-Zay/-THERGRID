# Groq specialist agents and grid skills

ÆTHERGRID keeps VÆLON (optimization), AUREN (spatial interpretation), SOLVÆR (simulation/evidence), and TEAM independently executable. All four may use the same model with different roles; this is not a claim of four different foundation models.

## Secure local connection

The existing Windows launcher loads `.env`, `.env.aethergrid`, then `.env.secrets`; process environment settings take precedence. Copy `apps/aethergrid-console/.env.secrets.example` to the untracked `.env.secrets` beside the extracted launcher and privately set `AETHERGRID_GROQ_API_KEY`. No existing provider override is needed. Launch `START-AETHERGRID.cmd` once; the server calls Groq and the browser never receives the key. Existing `AETHERGRID_OPENAI_API_KEY` + explicit Groq endpoint configuration remains supported. Encrypted GitHub secrets stay in GitHub and are never distributed in ZIPs. Root direct-open HTML cannot start Node or perform private inference by itself.

Default: `openai/gpt-oss-20b` at `https://api.groq.com/openai/v1`. To independently replace a specialist model, set `AETHERGRID_VAELON_MODEL`, `AETHERGRID_AUREN_MODEL`, `AETHERGRID_SOLVAER_MODEL`, or `AETHERGRID_TEAM_MODEL` server-side. Corresponding `_PROVIDER`, `_BASE_URL`, `_API_KEY` and `_TIMEOUT_MS` overrides retain precedence. Ollama and explicitly labeled local fallback remain supported.

Groq-hosted GPT-OSS 20B/120B requests explicitly select low reasoning effort within the existing 512-token specialist and 768-token synthesis caps. Other models and compatible endpoints keep their existing request parameters. This bounds reasoning overhead; a successful visible response is still required, and an empty response is never accepted as success.

## Skills

| Skill               | Effect                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inspect_context`   | Inspect current city, selected entity, view, layers and time as operator-supplied context.                                                                                        |
| `read_observations` | Read bounded server-recorded observations with source receipts; empty means no evidence.                                                                                          |
| `set_view`          | Select solid, wireframe, grid, xray, holographic, operations or reality rendering.                                                                                                |
| `set_layer`         | Show/hide a named existing map layer, including mapped grid, weather, radar, aviation or transit.                                                                                 |
| `focus_location`    | Focus the map at bounded latitude/longitude.                                                                                                                                      |
| `set_time`          | Return live, or select an explicit historical/forecast UTC time. Existing data-availability rules remain.                                                                         |
| `compare_scenario`  | Compute an explicit local generation/load balance comparison; this is arithmetic with declared assumptions, not measured electrical flow or a validated power-network simulation. |

Model-selected actions are allowlisted on the server and checked again in the React client. A fresh completed request applies valid visualization changes and offers Undo. Reviewing history, stopping a request, fallback, partial TEAM failure, malformed actions and unsupported fields do not execute changes. TEAM applies only the synthesizer's actions; specialist proposals remain contribution evidence. No tool runs shell commands, fetches arbitrary URLs, edits credentials, actuates physical infrastructure or submits paid quantum hardware jobs.

Try: “AUREN, switch to grid view and show the grid and energy layers.” Or: “VÆLON, compare a modeled 2500 MW load and 2300 MW generation with load reduced 10% and generation increased 5%.” Ask SOLVÆR to explain the assumptions and missing observations.

## Free plan and quotas

Use a Groq Free organization/project with a key authorized for that plan. Application code cannot enforce the upstream billing plan of an already-paid account. There is no automatic switch to a paid provider or different model. As checked October 23, 2026, Groq lists GPT-OSS 20B and 120B on Free with 30 requests/minute, 1,000 requests/day, 8,000 tokens/minute and 200,000 tokens/day; account limits are authoritative and may change. All specialists sharing credentials consume the same upstream organization quota; TEAM includes three specialist calls plus synthesis, and tools add roundtrips.

The runtime bounds tool rounds/calls, uses conservative completion budgets, serializes requests sharing credentials, reports returned rate-limit headers, and honors `429`/`Retry-After` through a shared cooldown. An actual upstream HTTP 429 with a delay of at most ten seconds permits one automatic resend for the entire agent completion, including its tool rounds. The existing deadline cancels the wait; repeated limits, longer waits and other requests encountering the shared cooldown return the visible limit state. Retrying the provider message does not execute an already completed local tool again. Keys are never rotated and fallback is never concealed. Configuration is labeled unverified until actual successful inference. Connection status distinguishes latest execution, last successful execution, partial TEAM response and cooldown.

## Verification and release boundary

Baseline main `7558309a648fd5fd59633b2636ebfa78a96890fe`, release v0.3.1, has protected Groq execution evidence for all three specialists and TEAM in [canonical run 39892894560](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/39892894560). That evidence predates these skills and does not verify the changed code.

The maintained protected canonical provider script now requires each specialist to choose `set_view`, return a valid grid action, and supply an authenticated request identifier and execution receipt. TEAM must supply three successful distinct contributions plus a real synthesis that selects and completes its own grid-view tool call. No secret is available in this development workspace, so local tests verify provider/tool protocol with controlled HTTP servers; live skill acceptance must pass against the final protected main candidate before a v0.4.0 release claim.

Sources: [Groq supported models](https://console.groq.com/docs/models), [rate limits](https://console.groq.com/docs/rate-limits), [local function calling](https://console.groq.com/docs/tool-use/local-tool-calling). This change is the agent batch of the larger v0.4.0 mission; the capability audit records remaining spatial/UI/mobility work.

Post-merge check: [run 40000105171](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/40000105171), main `4ac8ae2382e1c68c22df572f1686afe366177db8`, verified real grid tool calls from all three specialists. TEAM was partial: VÆLON and SOLVÆR returned empty assistant content during contribution requests, while AUREN and the synthesizer responded. Safe diagnostics reported no HTTP 429 or cooldown for those failures. See [Groq reasoning options](https://console.groq.com/docs/reasoning).

With low reasoning, [run 40004016406](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/40004016406), main `6f043aaafe6a936276a3c31bd0f46ec2862b50ff`, verified all three individual grid tool calls and all three TEAM contributions. The synthesizer completed its grid tool, but its final provider message received HTTP 429 with a six-second retry delay. Pending actions were discarded and TEAM remained degraded. The bounded short-cooldown retry is awaiting protected acceptance; this checkpoint is not a completed TEAM success claim.
