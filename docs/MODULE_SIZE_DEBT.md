# Module size debt

The default ceiling is 500 nonblank, noncomment code lines. `npm run lint` checks maintained JavaScript and TypeScript source and tests. ESLint also enforces `max-lines` on maintained JavaScript. These existing exceptions freeze the current sizes; they do not allow unlimited growth. Extract responsibilities with behavioral tests, lower the budget after extraction, and remove it at 500 lines or below.

The settings and provider-time/weather helpers now have independent classic-script modules because the legacy console and inlined standalone HTML must continue to open without a module server. React drawer state, operational provider lifecycles and radar state now live in dedicated hooks.

| Existing module | Maximum code lines | Next boundary to extract |
| --- | ---: | --- |
| `apps/aethergrid-console/ai-runtime.mjs` | 675 | Extract cohesive runtime or presentation responsibilities |
| `apps/aethergrid-console/app.js` | 3462 | Legacy renderer geometry and workspace controllers |
| `apps/aethergrid-console/geo-runtime.mjs` | 851 | Extract cohesive runtime or presentation responsibilities |
| `apps/aethergrid-console/providers/transit-registry.mjs` | 530 | Extract cohesive runtime or presentation responsibilities |
| `apps/aethergrid-console/server.mjs` | 1231 | Extract cohesive runtime or presentation responsibilities |
| `apps/aethergrid-console/web/src/app/App.tsx` | 2132 | Spatial acquisition and intelligence workspace composition |
| `apps/aethergrid-console/web/src/components/QuantumPanel.tsx` | 762 | Extract cohesive runtime or presentation responsibilities |
| `apps/aethergrid-console/web/src/components/ScenarioComposerPanel.tsx` | 553 | Extract cohesive runtime or presentation responsibilities |
| `apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts` | 623 | Extract cohesive runtime or presentation responsibilities |
| `apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts` | 910 | Extract cohesive runtime or presentation responsibilities |
| `apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts` | 1324 | Extract cohesive runtime or presentation responsibilities |
| `apps/aethergrid-console/web/src/services/city-power-overlay.ts` | 759 | Extract cohesive runtime or presentation responsibilities |
| `apps/aethergrid-console/web/src/services/operator-scenario.ts` | 578 | Extract cohesive runtime or presentation responsibilities |
| `scripts/verify-release-readiness.mjs` | 905 | Release, package and workflow contract groups |
| `tests/aethergrid-ai-runtime.test.mjs` | 838 | Split behavioral suites by maintained contract |
| `tests/aethergrid-console.test.mjs` | 506 | Split behavioral suites by maintained contract |
| `tests/aethergrid-global-quantum-profile.test.mjs` | 844 | Split behavioral suites by maintained contract |
| `tests/aethergrid-v4-provider-foundation.test.mjs` | 822 | Split behavioral suites by maintained contract |
| `tests/aethergrid-v4-web-foundation.test.mjs` | 1146 | Split behavioral suites by maintained contract |
