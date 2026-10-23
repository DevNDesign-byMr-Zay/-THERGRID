# Groq grid agents Implementation Plan

> **For agentic workers:** Use Superpowers test-driven development and verification before completion. Parallel independent backend/frontend work is authorized by the supplied mission.

**Goal:** Make three Groq specialists respond with bounded grid skills and truthful execution evidence.
**Architecture:** Existing server-only provider runtime; allowlisted model tools emit typed app actions; existing React state applies changes with undo.
**Tech Stack:** Node ES modules, React/TypeScript, Cesium, node:test, Playwright.
**Spec:** docs/superpowers/specs/2026-10-23-groq-grid-agents-design.md

## Global Constraints
- ZERO REGRESSION; preserve offline and provider-neutral contracts.
- No embedded keys, paid fallback, physical infrastructure actuation, arbitrary code or model-directed URLs.
- Free account limits vary; status requires successful execution receipts.

## Review Focus
- Malformed or excessive model tools must not mutate app state.
- Partial TEAM failures must remain visible.
- Stopped/replaced chat requests must not later apply actions.
- Shared quotas must not trigger retry storms or leak secrets.
- Inspection context remains operator-supplied unless backed by server observations.

### Task 1: Runtime and skills
Files: agent-config.mjs, ai-runtime.mjs, new agent-grid-skills.mjs, tests/aethergrid-agent-skills.test.mjs, tests/aethergrid-ai-runtime.test.mjs.
- [x] Write and run failing tests for tool roundtrip, validation, limits, provider status, cooldown, TEAM partial failure.
- [x] Implement bounded tools and typed actions, preserve old providers and receipts.
- [x] Verify tests and formatting; commit only owned files.
Interfaces: actions: {type:'set_view',view:string}|{type:'set_layer',layer:string,enabled:boolean}|{type:'focus_location',latitude:number,longitude:number,label?:string}|{type:'set_time',mode:'live'|'historical'|'forecast',at?:string}. response.actions is an array, summary.agents may include lastExecution and skills; runtime may include rateLimit, retryAfterSeconds, executionStatus.

### Task 2: React grid actions and connection evidence
Files: web/src/components/AgentDock.tsx, AgentModelPanel.tsx, app/App.tsx, services/agent-client.ts, agent-model-status.ts, new grid action validator, focused Playwright tests.
- [x] Write and run failing tests for allowlisted actions, undo, malformed actions, failure state.
- [x] Validate backend actions again; apply actions on fresh completed requests only, through existing controls with a visible undo option.
- [x] Show skills and execution/limit state; no key input in client.
- [x] Typecheck, build, tests, commit only owned files.
Interfaces: consume response.actions defined in Task 1; task owner aligns allowed view/layer identifiers with real app values and sends them to runtime owner.

### Task 3: Server context, protected proof and integration
Files: server.mjs, scripts/aethergrid-canonical-provider-smoke.mjs, workflow, configuration docs and tests.
- [x] Preserve selected feature/time/layer context; distinguish failed/fallback evidence from provider proof.
- [x] Add read-only live proof script requiring all specialists and TEAM receipts and safe grid tool selection.
- [x] Inspect protected workflow evidence, maintain existing environment binding protections.
- [x] Run full regression checks, browser UI tests and package smoke; fresh review; open reviewable PR with exact limitations.

## Verification checkpoint

608 root tests passed, coverage94.45% lines/79.63% branches/95.90% functions; 18 focused desktop/mobile browser checks passed; both TypeScript gates, lint, formatter, release readiness and extracted package smoke passed. All three fresh-review Important findings fixed and re-reviewed clean. New authenticated Groq skill execution remains pending the protected exact-main workflow; baseline v0.3.1 protected responses do not verify these changes. Docker and native Windows execution were not run in this workspace. The remaining v0.4.0 city/hover/traffic/radar work is in the capability audit.
