# ÆTHERGRID Production Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute natively in this session after user plan review; do not delegate unless the user selects delegation.

**Goal:** Deliver the first focused frontend PR: a polished, accessible production shell with accurate source/readiness states and authenticated UX only when Jules publishes its real API contract.

**Architecture:** Extend the canonical React shell without remounting the spatial viewport. Extract small pure source-state helpers and an abortable provider-readiness hook; keep profile persistence separate from authenticated identity. Preserve backend adapters, renderer geometry and release packaging in this PR.

**Tech Stack:** React 19, TypeScript, Cesium, Vite, Playwright; maintained Node 22 runtime.

**Spec:** `docs/superpowers/specs/2026-10-11-canonical-spatial-experience-design.md`

## Global Constraints

- Baseline inspected: main and released `v0.2.1` at `9b61b86e674d2bd35f7fcfb6ecf71fec7d6e5283`; refresh before execution.
- Backend provider adapters, authentication services and release packaging remain outside this frontend workstream.
- D-Wave stays on hold, unconfigured and non-executable; no hardware job or release is part of this assignment.
- Configuration success is not live verification. Historical views cannot reuse current observations.
- Keep the world viewport mounted across navigation and presentation changes.
- Missing authentication contracts are explicit unfinished dependencies; no invented endpoint names, roles, credentials or placeholder components.
- All required gates retain current coverage thresholds; use Node 22, not the local default Node 24.

## Review Focus

1. Opening the native profile dialog while a compact drawer is active must not create competing focus traps.
2. A slow readiness response must not overwrite a newer refresh or update an unmounted panel.
3. Theme changes must remain usable when storage throws or the OS changes its appearance.
4. Narrow landscape, text zoom and touch keyboards must keep close/apply controls reachable without document overflow.
5. Static mapped sources, unknown registry states and stale observations must not be presented as live measurements.

## Delivery boundaries

This is the plan for PR 1 only. City realism, temporal operations, holographic tools and specialists remain separate plans/PRs in the approved order. Operational readiness/source-label changes belong here; provider measurements and renderer changes remain in their later PRs.

The live open-PR inspection currently shows only dependency PRs #146 and #149. The inspected server exposes profile GET/PUT but no user-authentication routes. Task 5 therefore has a contract gate. A shell checkpoint may be published with authentication explicitly incomplete; it cannot be described as a completed authenticated UX PR.

## Task 1: source status that preserves provenance

**Files:** Create `apps/aethergrid-console/web/src/services/source-presentation.ts`; modify `src/components/DataSourceBadge.tsx` and its call site in `src/app/App.tsx`; create `apps/aethergrid-console/web/tests/production-source.spec.ts`.

**Interfaces:** Export `SourcePresentationState = 'live' | 'stale' | 'simulated' | 'fallback' | 'unavailable' | 'loading' | 'mapped'`. Export `sourcePresentationState(input: { loading?: boolean; unavailable?: boolean; live?: boolean; stale?: boolean; simulated?: boolean; mapped?: boolean; fallback?: boolean }): SourcePresentationState`. DataSourceBadge consumes this type. Unknown provenance is unavailable; mapped topology stays mapped even when the backend says its fetch was live. Simulation remains simulated and carries separate age metadata.

- [ ] Write pure contract tests for stale live receipts, loading, failed responses, explicit simulation, unclassified fallback, static mapped data and unknown state. Assert `sourcePresentationState({ live: true, stale: true }) === 'stale'`, `{ mapped: true, live: true } === 'mapped'`, `{ simulated: true } === 'simulated'`, and `{}` equals unavailable.
- [ ] Run `npm --prefix apps/aethergrid-console/web test -- tests/production-source.spec.ts --workers=1`; confirm failure is the missing helper rather than server setup.
- [ ] Implement the helper with precedence unavailable → loading → simulated → stale → mapped → live → fallback → unavailable. Pass the actual overlay stale flag from App; mark OSM power as mapped topology and reserve simulated for explicitly modeled data. Retain provider attribution/source and fetch timestamps.
- [ ] Add a browser assertion against a deterministically intercepted source response: stale receipts have STALE text and no LIVE badge; mapped sources have MAPPED text. Use fixture schemas from the maintained source clients, with test fixtures explicitly labeled offline.
- [ ] Run the new tests, existing weather/operational contracts and web typecheck; commit `fix(frontend): preserve source freshness and mapped status`.

## Task 2: abortable, truthful Connection Center

**Files:** Create `apps/aethergrid-console/web/src/hooks/use-provider-readiness.ts`; modify `src/components/RuntimeDiagnosticsPanel.tsx`; create `apps/aethergrid-console/web/tests/production-readiness.spec.ts`.

**Interfaces:** `useProviderReadiness(): { runtime: RuntimeDiagnostics | null; providers: PublicProviderRuntime | null; loading: boolean; error: string | null; checkedAt: string | null; refresh(): void }` consumes existing `loadRuntimeDiagnostics(signal?)` and `loadPublicProviderRuntime(signal?)`. `checkedAt` is the frontend registry-check time, never a source observation or live-provider-success time.

- [ ] Write route-intercepted browser tests: configured/ready registry rows say NOT LIVE VERIFIED; malformed/unknown status does not become ready; failed refresh shows unavailable/error and cannot silently certify the old row. Delay request A, trigger B and resolve A last; only B remains displayed.
- [ ] Run `npm --prefix apps/aethergrid-console/web test -- tests/production-readiness.spec.ts --workers=1`; verify the race/readiness assertions fail on the baseline.
- [ ] Implement the hook with a per-refresh AbortController/request generation, cleanup on unmount and no late state writes. Preserve previous rows only with an explicit stale-registry marker when refresh fails. Keep provider-success latency/cache/circuit metadata UNKNOWN unless an existing typed backend contract actually returns it.
- [ ] Refine Connection Center operator copy, registry-check timestamp, retry affordance and accessible loading/error status. Show D-Wave ON HOLD in its existing status text; add no new hardware UI. Avoid displaying raw errors/payload fields that could contain credentials.
- [ ] Run the new tests, web build and root runtime/frontend tests; commit `fix(frontend): make provider readiness refresh race-safe`.

## Task 3: coherent navigation, keyboard and profile focus

**Files:** Modify `src/app/App.tsx`, `src/hooks/use-command-drawer.ts`, `src/hooks/use-operator-shortcuts.ts`, `src/components/ProfileMenu.tsx`, `src/app/command-center.css`; create `apps/aethergrid-console/web/tests/production-shell.spec.ts`.

**Interfaces:** Preserve the existing `useCommandDrawer(open, onClose)` API and shortcuts API. App owns exclusive drawer state. Before the profile dialog opens, close active compact drawers; allow ProfileMenu an `onBeforeOpen?(): void` prop. Give its dialog a programmatic accessible name. Profile remains local operator identity until authentication is available.

- [ ] Write browser tests for navigation ↔ intelligence ↔ profile on compact screens; Tab stays in the topmost surface, Escape closes it and focus returns to a connected trigger. Assert a product switch preserves the viewport canvas node and temporal cursor.
- [ ] Add tests that single-letter shortcuts do not change workspaces while a dialog owns focus or while typing/editing. Test desktop drawer close/reopen, not only the existing compact focus case.
- [ ] Run the new shell tests to identify genuine failing behavior; do not change already passing behavior solely to mirror a test.
- [ ] Implement exclusive transitions, safe dialog opening/focus return, shortcut guards and inert/hidden semantics for closed panels. Preserve reduced-motion settings and source selection. Keep transition feedback short and avoid viewport remounts.
- [ ] Run new shell tests plus all existing command-center acceptance tests; commit `feat(frontend): refine workspace and accessible panel transitions`.

## Task 4: complete appearance and responsive surface coverage

**Files:** Modify `src/app/app.css`, `src/app/command-center.css`, `src/hooks/use-appearance.ts` only if tests expose a defect; create `apps/aethergrid-console/web/tests/production-appearance.spec.ts`; extend `tests/production-shell.spec.ts`.

**Interfaces:** Preserve `AppearanceMode`, `ResolvedAppearance` and `useAppearance()` signatures. Use existing semantic theme variables; scene solar/weather settings remain independent from UI theme.

- [ ] Add browser tests using `page.emulateMedia({ colorScheme: 'light' })`, then dark: SYSTEM changes the root theme; explicit DARK/LIGHT ignores later OS changes. Make localStorage writes throw in a test and assert in-memory choice still works.
- [ ] Exercise profile, settings, agents, OPS and inspector under both themes; measure WCAG AA text contrast for representative normal text (4.5:1) and focus/control boundaries (3:1). Assert a visible focus indicator without relying solely on color.
- [ ] Add six maintained viewport tests plus 844×390 landscape and 200% text-size emulation. Assert no horizontal document overflow; close and action controls remain reachable through the intended internal scroller. Verify 44×44 CSS-pixel primary touch targets on compact layouts and safe-area padding.
- [ ] Run the tests and fix only demonstrated styling/layout defects. Add light-theme tokens to hardcoded dark surfaces; keep typography, brand artwork and actual scene unchanged. Reduced-motion mode removes decorative panel transitions and retains focus behavior.
- [ ] Build and run the combined shell/source/readiness/appearance suite; commit `feat(frontend): polish responsive light and dark operator surfaces`.

## Task 5: consume authenticated APIs when published

**Files, when a real contract exists:** Create `src/services/auth-client.ts`, `src/hooks/use-auth-session.ts`, `src/components/AuthenticationPanel.tsx` and `tests/production-auth.spec.ts`; modify `src/components/ProfileMenu.tsx` and `src/app/App.tsx`. All paths are under `apps/aethergrid-console/web/`. Do not create these files while the contract is absent.

**Interfaces:** Exact API routes, session payload type, CSRF transport, role/capability fields and login/logout semantics must come from Jules' published contract. No frontend endpoint or permission schema is specified here because none exists in the inspected baseline. A frontend identity component must not call the local workspace-session store an authentication service.

- [ ] Refresh main and inspect Jules' PR/contracts; record the concrete route/method, session transport, identity/capability fields, expiry and 401/403 policy in this plan before coding. If absent, finish with an explicit auth unavailable state in existing profile/Settings copy and report this task blocked; do not fabricate a login form.
- [ ] Once published, write contract/browser tests for anonymous, authenticated, denied, expired and unavailable states using exact server-shaped fixtures. Test logout during an in-flight privileged request and a late profile response from the former identity.
- [ ] Run those tests and verify baseline failures; implement only the frontend consumer, request cancellation and server-derived capability affordances. Keep session secrets out of storage, logs and exports. Backend remains the authority and denies unauthorized requests independently.
- [ ] Validate real authorized runtime behavior through the maintained environment without capturing credentials. Confirm profile labels distinguish local profile from authenticated identity.
- [ ] Commit the authenticated consumer only after build and browser tests pass; otherwise keep the task explicitly incomplete.

## Task 6: exact-head evidence and focused PR delivery

**Files:** Create `docs/acceptance/aethergrid-command-center/2026-10-11-PRODUCTION-SHELL.md` and browser screenshots; modify `.github/workflows/aethergrid-v4-web.yml` only to run/retain the new credential-free frontend acceptance tests, leaving provider/release workflows unchanged.

- [ ] Use maintained Node 22 and available Chromium. Build the compiled canonical app and run the new tests plus the existing browser suite with `AETHERGRID_TEST_CANONICAL=1`. Report credentialed/live tests separately; intercepted contract tests never count as provider validation.
- [ ] Run maintained root test/coverage, lint, format, root/strict-renderer typecheck and web build checks. Preserve packaging smoke and release-readiness checks required by Engineering CI. Diagnose failures before retrying; do not weaken thresholds.
- [ ] Capture actual desktop/tablet/mobile dark/light screenshots from the compiled app, including profile, Settings/readiness and open drawers. Keep test fixture screenshots labeled fixture-backed; exclude credentials and unintended personal information.
- [ ] Add the new offline suite and evidence paths to the v4 workflow so PR browser acceptance is reproducible in CI. Keep existing real-city smoke tests and dependency/runtime policy.
- [ ] Review the diff against the approved spec: no backend rewrites, fake auth, decorative controls, hidden stale data, viewport replacement or D-Wave additions. Scan evidence for credential leakage before publication.
- [ ] Publish focused PR 1 against current main. Record final head SHA, browser results/screenshots and root gates. Wait for Engineering CI, v4 web and CodeQL; fix failures on the same focused branch. Do not merge or publish a release unless separately authorized.

## Self-review result

The six tasks cover approved PR 1: source badges (1), Connection Center (2), transitions/accessibility/profile (3), themes/responsiveness (4), contract-gated auth (5), browser/CI/evidence (6). All five Review Focus conditions have task-specific tests. PRs 2–5 retain their approved scope and receive dedicated plans after this checkpoint. The only known PR 1 external dependency is Jules' authentication contract.

## Execution handoff

Recommended execution method: native, in this session. These tasks share shell state and styles, and sequential execution reduces overlapping changes. User review of this plan is required before implementation by the writing-plans workflow. If the user selects delegation, use the required subagent development skill instead.
