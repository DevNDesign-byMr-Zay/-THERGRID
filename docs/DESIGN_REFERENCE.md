# Verified command-center reference

The maintained React/Cesium command-center visual reference is the repository capture:

[`docs/acceptance/aethergrid-command-center/command-center-1536x1024.png`](acceptance/aethergrid-command-center/command-center-1536x1024.png)

It is a valid 1536 × 1024 PNG from the merged frontend acceptance evidence. Additional verified responsive viewport captures live in the same directory. This is an application capture, not a fabricated replacement design. It establishes the command-center composition; source-specific Cesium captures in that historical evidence directory may show an earlier degraded provider run and do not establish current live-provider success.

The former `apps/aethergrid-console/assets/dashboard-reference.webp` could not be decoded as an image. It was removed and the legacy `app.json`/`ui.json` repository-reference fields now point to the verified command-center capture. The manifests explicitly exclude the reference from the runtime package, and neither frontend uses it as a UI background. The reference path is repository-root relative.

Brand artwork remains supplied repository assets. See [BRAND_ASSETS.md](BRAND_ASSETS.md). Canonical application packaging is handled by its own integration lane; this reference cleanup does not change runtime entrypoints or package selection.
