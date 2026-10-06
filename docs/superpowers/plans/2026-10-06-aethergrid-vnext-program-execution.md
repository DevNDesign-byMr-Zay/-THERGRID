# ÆTHERGRID vNext Program Execution Map

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement detailed lane plans task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver the universal ÆTHERGRID command center through two coordinated non-overlapping engineering lanes: Work owns canonical product UX/integration; Jules owns runtime/data/agent/provider/control foundations.

**Architecture:** Work and Jules develop from the same canonical main baseline but on separate feature branches. Jules publishes server-side contracts and provider/runtime capabilities; Work consumes those contracts in the React/Cesium command center. No agent may invent live provider responses to compensate for an unavailable backend.

**Tech Stack:** Node.js, React, TypeScript, Vite, CesiumJS, existing provider registry, Groq OpenAI-compatible runtime, IBM Quantum runtime, Playwright, Node test suite.

**Spec:** `docs/superpowers/specs/2026-10-06-aethergrid-universal-command-center-design.md` on `spec/aethergrid-universal-command-center`.

## Global Constraints

- React/Cesium is the only normal user-facing product.
- The application shell is scrollless; bounded panels may scroll internally.
- Light, Dark and System themes must be fully legible.
- Safe read-only/live capabilities auto-start on UI open.
- No paid/scarce quantum job, physical control, new write permission or new MCP authorization auto-executes.
- No synthetic/inferred state may be labeled live observation.
- No secret may enter the browser bundle, tracked env, evidence export or logs.
- Visible controls must perform a real action or be truthfully disabled.
- Agents operate through typed tools/capabilities and governed permissions.
- Physical/external high-impact actions use ActionPlan → policy → simulation/validation → authorization → deterministic gateway → verification.
- Provider integrations stay replaceable and license-aware.
- TDD, fresh-clone, packaging, CI and CodeQL remain green.

## Review Focus

- Theme surfaces that remain dark under Light mode must retain legible foregrounds.
- Auto-bootstrap must not create unbounded provider polling or repeated paid model/hardware calls.
- View-mode transitions must preserve selected geography/time/context rather than instantiate fake replacement scenes.
- External tools/MCP/voice must not escalate authority beyond the operator's granted scopes.
- Stale, interpolated, forecast, hypothetical and fallback states must remain visually and semantically distinct from observed live data.

---

## Lane A — ChatGPT Work: Product UX, Cesium, integration and acceptance

### A1. Canonical product convergence + theme repair

**Files:**
- Modify: `apps/aethergrid-console/web/src/app/App.tsx`
- Modify: `apps/aethergrid-console/web/src/app/app.css`
- Modify: `apps/aethergrid-console/web/src/app/command-center.css`
- Modify/Create: focused settings/theme components and hooks under `apps/aethergrid-console/web/src/components/` and `web/src/hooks/`
- Modify: release/readiness docs/tests that identify canonical UI entrypoints.
- Test: `tests/aethergrid-v4-web-foundation.test.mjs`
- Test/Create: Playwright theme/layout acceptance specs.

**Produces:** one user-facing React/Cesium shell, semantic theme tokens, scrollless layout, working Settings shell.

### A2. Auto-bootstrap + unified view modes

**Files:**
- Modify: `web/src/components/SpatialViewport.tsx`
- Modify: `web/src/renderer/cesium/*`
- Modify: `web/src/renderer/renderer-manager.ts`
- Create: view-mode controller/presentation modules.
- Create: startup/bootstrap client hook/service.
- Test: renderer/view/bootstrap tests and Playwright command-center specs.

**Produces:** LIVE/Reality, Wireframe, Telemetry, 4D, Holographic, Scenario presentation modes over one world/session; safe automatic initialization.

### A3. Contextual operational UX

**Files:**
- Modify: AgentDock/QuantumPanel/OperationalDataPanel/Scenario/Evidence surfaces.
- Create: Plugins settings, MCP settings, Voice settings, provider/model assignment UI, authority indicator.
- Modify: web service clients only; do not implement server provider behavior in this lane.

**Consumes:** Jules-published runtime/tool/plugin/MCP/voice contracts.

**Produces:** hands-on panel controls, no toast-only placeholders, real status/action feedback.

### A4. Domain visualization framework + Air Traffic visual pack

**Files:**
- Create: domain visualization registry under `web/src/domains/`.
- Create: aviation Cesium layer/renderers, aircraft LOD/model/orientation/trails/labels.
- Modify: SpatialViewport/view-mode integration.
- Test: data-to-render mapping and Playwright visual/interaction acceptance.

**Consumes:** Jules canonical aircraft feed contract.

**Produces:** source-backed moving 3D aircraft with observed/interpolated/predicted truth states and domain-specific animation.

### A5. Cinematic/performance + integrated acceptance

**Files:**
- renderer animation/performance modules;
- CSS motion tokens;
- Playwright/browser acceptance;
- release-readiness docs/tests.

**Produces:** HQ cinematic launch/city transitions/domain animations, adaptive performance, reduced-motion equivalent, final integrated evidence.

---

## Lane B — Jules: Data fabric, agents, plugins, MCP, voice runtime, providers and control foundations

### B1. Universal event/data fabric + KPI engine + Domain Pack SDK

**Files:**
- Create: `apps/aethergrid-console/data-fabric/`
- Create: `apps/aethergrid-console/kpi/`
- Create: `apps/aethergrid-console/domains/`
- Create: normalized contracts/schemas under `apps/aethergrid-console/contracts/`
- Modify: server route registration only as required.
- Test: new unit/contract tests under `tests/`.

**Produces:** canonical observation/event envelope; adapter interface; KPI registry/evaluator; domain-pack manifest/registry.

### B2. Agentic runtime + plugin registry + role-specific models

**Files:**
- Modify: `agent-config.mjs`, `ai-runtime.mjs`
- Create: `agents/tool-registry.mjs`, orchestration/context/action modules.
- Create: `plugins/` capability registry.
- Modify: provider/runtime safe summaries.
- Test: agent/tool permission/orchestration/model fallback tests.

**Model defaults:**
- AUREN: `qwen/qwen3.8-27b`, fallback `openai/gpt-oss-120b`.
- VÆLON: `openai/gpt-oss-120b`.
- SOLVÆR: `qwen/qwen3.8-27b`, fallback `openai/gpt-oss-120b`.
- TEAM: `openai/gpt-oss-120b`.

**Produces:** real tool-using agents, shared bounded context, handoffs, TEAM synthesis, per-agent plugins and safe fallback behavior.

### B3. MCP + Voice + Quantum action contracts

**Files:**
- Create: MCP server/client modules, scoped tool/resource catalog and connection registry.
- Create: voice transcription/command-router modules using configured Groq speech endpoint.
- Modify: quantum routes/runtime for typed guarded workload preparation/submission.
- Create: shared command/action bus.
- Test: scopes, auth boundaries, voice routing, no authority escalation, no auto hardware submission.

**Produces:** Settings-manageable MCP backend; external AI control surface; voice commands into the same command bus; guarded IBM workload operations.

### B4. Air Traffic reference provider pack + Markets contracts

**Files:**
- Create: `domains/aviation/` provider interface, canonical aircraft schema, cache/freshness/rate-limit logic and API routes.
- Create: `domains/markets/` provider-neutral securities/FX/crypto/futures/options/rates/commodities schemas and KPI definitions.
- Test: provider normalization, stale/interpolation metadata, licensing/config states, no invented flight number or market execution.

**Produces:** live aviation backend contract for Work; market-domain architecture ready for future provider credentials.

### B5. Governed Action Gateway + cost/quota hardening

**Files:**
- Create: `control/action-plan.mjs`, policy/approval/gateway interfaces, simulation/dry-run adapters and evidence receipts.
- Extend provider quota/cache/circuit-breaker support.
- Test: denied authority, staged action, simulated action, approval requirement, no direct LLM actuator path.

**Produces:** reusable safe action architecture for grid, enterprise, cyber, logistics and future market integrations.

---

## Integration order

1. A1 and B1 can run in parallel.
2. Merge/rebase B1 contracts before A3/A4 consume them.
3. A2 can proceed in parallel with B2.
4. B3 must publish stable MCP/voice/quantum contracts before A3 final wiring.
5. B4 aircraft contract lands before A4 live aviation acceptance.
6. B5 and A5 finish after all prior contracts are stable.
7. Final integrated branch must pass full Engineering CI, CodeQL, fresh-clone, container/package smoke, Playwright and canonical live evidence.

## Branch ownership

- Work branch: `feat/aethergrid-command-center-vnext`
- Jules branch: `feat/aethergrid-runtime-vnext`
- Both start from current `main` at assignment time, not a remembered SHA.
- Neither merges directly to main.
- Each opens PRs at coherent checkpoints.
- Rebase/merge latest main before downstream waves.

## Shared-file rule

Work owns `apps/aethergrid-console/web/**` UI/renderer code.
Jules owns server/runtime/provider/data-fabric/domain backend code outside `web/**`.
Shared root/package/config changes require a dedicated commit and explicit note in the PR to reduce merge conflicts.
