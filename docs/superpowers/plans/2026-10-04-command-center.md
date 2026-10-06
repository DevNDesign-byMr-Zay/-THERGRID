# ÆTHERGRID command center implementation plan

Goal: Restore the branded viewport-bound React/Cesium operator experience described in the supplied production activation brief.

Architecture: Keep the existing renderer, temporal clock, provider clients and backend contracts. Restructure shell presentation into product navigation, exclusive intelligence workspaces and secondary inspector views. Use canonical maintained artwork without redrawing it.

Scope: `apps/aethergrid-console/web/**` and frontend acceptance tests. Provider adapters and backend internals remain Jules' responsibility. Never submit hardware work during acceptance.

1. Add real browser assertions for the six requested viewports, canonical branding, primary navigation, exclusive workspaces, bounded rails and responsive drawers. Run against the existing runtime to establish failures.
2. Consolidate `App.tsx` navigation and secondary tools. Restore logos in `AgentDock.tsx`; preserve per-agent histories, role behavior and provider provenance.
3. Add a dedicated viewport shell stylesheet, readable typography and responsive drawers. Keep the page fixed while intentional workspace/history scrollers remain bounded. Support keyboard dismissal, focus recovery and reduced motion.
4. Run web build/typecheck, repository tests, strict renderer typecheck, lint and formatting. Validate real runtime provider states without supplied credentials; record unavailable activation separately from frontend acceptance.
5. Publish a focused PR with exact base SHA, gates, browser evidence and remaining activation blockers.

Review focus: Short desktop height; narrow touch layouts; switching product modes while a drawer is closed; keyboard focus when a drawer opens/closes; unavailable providers must never appear live.

Activation prerequisites: GitHub browser is signed out and provider credentials referenced by the brief are absent from this session. The dashboard reference file is undecodable at the base commit; canonical brand files are valid. No fabricated credentials, CRN or provider responses will be used.
