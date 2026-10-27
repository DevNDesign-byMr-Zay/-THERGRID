# AETHERGRID score-recovery design — 2026-10-27

## Purpose

Improve independently verifiable engineering quality for a buyer-facing assessment, while preserving the maintained application and its simulation-before-actuation safety boundary. The supplied assessment prioritizes fresh-clone tests, cohesive modules, and credential-free verification. The current main already has 627 passing Node tests, a passing web build, committed lockfiles and CI; the assessment's absence-of-tests claim needs a rescan of the current SHA, not invented replacement tests.

## Approaches considered

1. **Evidence only:** surface existing test/CI proof in documentation. Lowest risk, but it leaves genuine maintainability and environment gaps untouched.
2. **Focused, tested engineering hardening (selected):** portable syntax verification, missing environment templates, guarded credential-free test execution and a cohesive backend extraction. Each is independently testable and preserves existing public interfaces.
3. **Broad rewrite of all three oversized files:** could yield more immediate line-count improvement, but would increase regression risk across renderers, state and transport and is not defensible as one unreviewed change.

## Scope and constraints

- Do not weaken test, lint, build, coverage, provider security or release gates.
- No outbound provider credentials or network access for default test execution; loopback fixture servers remain allowed.
- Use Node 22-compatible ESM and preserve PowerShell usability.
- Extract pure city planning/metric logic from `server.mjs` without changing JSON responses or exports.
- Document precisely what was and was not validated; never rewrite Git history to manufacture a sustained maintenance record.
- No production deployment, external account interaction or physical actuation.

## Accepted implementation direction

The request explicitly directs maximum-effort adjustments to the highest-impact assessment items. The implementation will proceed on an isolated review branch with the focused hardening approach and distinct tested changes.
