# AETHERGRID Score Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the maintained repository's fresh-clone, offline and modularity guarantees easier to reproduce and assess.

**Architecture:** Preserve existing public API and safety contracts. Add a portable CLI syntax checker and offline network boundary, complete configuration documentation with tests, and move a pure city-planning subsystem out of the HTTP server behind static ESM imports.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, npm lockfiles, TypeScript/Vite web workspace, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-27-score-recovery-design.md`

## Global Constraints

- Maintain all existing API behavior, test scripts and CI gates.
- Do not make the default tests require external credentials or paid services.
- Preserve PowerShell compatibility and Node 22 support.
- Do not rewrite history or imply a new assessment score before rescoring.

## Review Focus

1. Invalid `.js` and `.mjs` nested in source paths must fail syntax verification with a nonzero exit code.
2. Syntax walking must ignore generated `node_modules` and `dist` directories.
3. The offline guard must allow IPv4/IPv6 loopback fixture sockets but reject public HTTP/HTTPS sockets.
4. Environment example parity must keep secret values blank and distinguish optional account-setup credentials.
5. City-analysis extraction must preserve planning indices, metric values, invalid-request errors and advisory-only responses.

---

### Task 1: Portable verification

**Files:** `scripts/check-syntax.mjs`, `tests/syntax-check.test.mjs`, `package.json`, `README.md`

**Interfaces:** CLI `node scripts/check-syntax.mjs [directory ...]`, exit 0 for valid source and nonzero for invalid syntax; default roots are `src tests scripts apps`.

- [ ] Write tests for invalid nested input and ignored generated directories.
- [ ] Run the tests red: expected missing checker.
- [ ] Implement checker and replace POSIX-only `find | xargs` npm script.
- [ ] Verify focused test, `npm run syntax` and full `npm test`.
- [ ] Commit scoped change.

### Task 2: Offline test proof and configuration hygiene

**Files:** `scripts/guard-offline-network.mjs`, `tests/aethergrid-offline-network.test.mjs`, `package.json`, `.env.example`, `apps/aethergrid-console/.env.example`, `tests/env-example.test.mjs`, `README.md`

**Interfaces:** `npm run test:offline` runs the maintained tests with an imported guard; loopback allowed, non-loopback sockets rejected. Templates document referenced runtime env vars without values for secrets.

- [ ] Write tests for guarded outbound sockets, loopback, and missing environment keys.
- [ ] Run them red: expected guard/template failure.
- [ ] Implement minimal guard, configuration additions and test script; describe limitation to Node-process socket paths.
- [ ] Run focused, offline and conventional suites.
- [ ] Commit scoped change.

### Task 3: Separate backend city-planning analysis

**Files:** `apps/aethergrid-console/analysis/city-use-cases.mjs`, `apps/aethergrid-console/analysis/city-metrics.mjs`, `apps/aethergrid-console/analysis/city-planning.mjs`, `apps/aethergrid-console/server.mjs`, `tests/aethergrid-city-analysis-module.test.mjs`

**Interfaces:** Export `CITY_USE_CASES`, `cityMeshMetrics`, `analyzeCityUseCase` through the server as before; pure modules import each other without HTTP/server state.

- [ ] Write tests that directly import module exports and assert representative metric and planning behavior.
- [ ] Run red: expected missing modules.
- [ ] Extract the existing code mechanically with ESM imports/exports, retaining numerical logic verbatim.
- [ ] Run targeted city tests, `npm test`, lint and typechecks; compare API outputs.
- [ ] Commit scoped change.

### Task 4: Final fresh-clone and buyer-facing evidence

**Files:** `README.md`, `docs/RESCORE_READINESS.md` (as appropriate).

- [ ] Verify root `npm ci`, `npm test`, `npm run lint`, typechecks, formatting and coverage.
- [ ] Verify web `npm ci` and `npm run build`; verify web lockfile is unchanged.
- [ ] Check branch diff and report platform/sandbox limitations honestly.
- [ ] Publish as a reviewable change if repository permissions and authenticated transport allow it.

### Task 4a: Security intervention discovered during verification

**Ruling:** The web package's separate audit exposed one critical and one high advisory; remediation precedes final handoff because shipping the affected lockfile would undermine the score-recovery goal. Exact pinned Vite, a DOMPurify override and both CI audit gates are in scope.

- [x] Capture the failing external web audit and write a failing locked-version regression test.
- [x] Pin patched dependency versions and regenerate the web lockfile.
- [x] Reinstall from scratch, build the web app and observe a zero-vulnerability web audit.
- [x] Run the full root quality/package/smoke gate and supported Node 22 offline tests.
- [ ] Verify browser UI acceptance in CI (local Chromium download was unavailable).
