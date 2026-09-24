# Contributing

## Principle

THERGRID is a deterministic evidence and simulation platform before it is an actuation system. Changes should strengthen the digital twin, simulation, provenance, solver evaluation, renderer-neutral scene contracts, operator evidence, or reproducibility without silently widening real-world authority.

## Development workflow

1. Start from current `main`.
2. Install with `npm ci --ignore-scripts`.
3. Make one focused behavioral or contract change.
4. Add or update the regression that proves the new behavior or failure boundary.
5. Run `npm run check` before pushing.
6. Keep provider-specific integrations behind adapters and preserve deterministic classical baselines.
7. Update `CHANGELOG.md` for meaningful maintained-surface changes.

## Safety and authority

No model, solver, renderer, dashboard, or evidence score becomes authoritative merely because it is more capable or more confident.

Changes involving proposals, solver evidence, promotion gates, spatial scenes, operator attention, or downstream render packets must preserve:

- simulation before actuation;
- explicit advisory/non-authoritative semantics;
- stable experiment/snapshot/request/provenance identity;
- fail-closed handling for stale or substituted evidence; and
- no physical side effects in tests or default demos.

## Required checks

Run the maintained quality path:

```bash
npm ci --ignore-scripts
npm audit --audit-level=moderate
npm run check
```

Container and CodeQL gates remain independent blocking checks in CI.

## Commit discipline

Prefer small commits that name the boundary they strengthen. Do not mix broad refactors, speculative architecture, dependency churn, and safety changes in one commit.

Never commit credentials, live infrastructure secrets, private grid/customer data, or real-world control tokens.
