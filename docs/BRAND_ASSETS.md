# ÆTHERGRID Brand Assets

The React command center uses product and AI-agent artwork from `apps/aethergrid-console/assets/brand/` through `web/src/components/brand.ts`. Earlier reusable artwork remains under `apps/operator-console/assets/brand/`. The verified command-center design reference is documented in [DESIGN_REFERENCE.md](DESIGN_REFERENCE.md).

## Product mark

- `aethergrid-logo-transparent.webp` — transparent-background ÆTHERGRID logo extracted from the approved operator-console visual direction.

The existing `assets/aethergrid-mark.svg` remains the lightweight renderer-native interface glyph. The transparent brand logo is the canonical product mark for marketing, documentation, presentation, and maintained UI use; the operator-console hero now renders this repository asset directly.

## AI agent marks

- `agents/vaelon.webp` — VÆLON optimization / scenario-exploration identity.
- `agents/auren.webp` — AUREN semantic / spatial-intelligence identity.
- `agents/solvaer.webp` — SOLVÆR simulation / evidence-generation identity.

`apps/operator-console/model-logos.js` references these files directly so the UI and reusable repository assets stay synchronized.

Do not recolor, redraw, or replace these marks casually. Derived variants should preserve the recognizable supplied identities and should be reviewed as brand changes.
