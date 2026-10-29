# ÆTHERGRID · THERGRID application platform

ÆTHERGRID is a maintained application platform for advisory energy digital twins and spatial intelligence. It combines a **Node.js application backend**, a **React + TypeScript frontend**, the **Cesium spatial engine**, provider adapters, real data integrations, an AI-agent runtime and quantum adapters. The repository/package name remains THERGRID / `thergrid`.

Operators explore global and city views, compare scenarios, inspect source receipts and work with VÆLON, AUREN, SOLVÆR and TEAM. Recommendations support human decisions. **Simulation before actuation:** the application has no authority to control physical infrastructure, and quantum experiments require a classical baseline.

> **Repository classification:** maintained application service and frontend. Docker/Compose are application packaging and runtime verification assets. This is **not an infrastructure-as-code repository**. See [Project scope](docs/PROJECT_SCOPE.md) and [.repo-class.json](.repo-class.json).

## Implemented today

- **Backend:** `apps/aethergrid-console/server.mjs` serves application APIs, provider readiness, agent conversations, profiles, spatial data and quantum runtime contracts. Pure city-use-case definitions, geometry metrics and planning analysis live in `apps/aethergrid-console/analysis/` and are independently testable. `src/` maintains the digital twin, simulation, health service and renderer-neutral evidence boundaries.
- **Frontend:** `apps/aethergrid-console/web/` contains the React/TypeScript command center, Cesium globe/city rendering, temporal and layer controls, responsive workspaces, agent conversations and provider diagnostics.
- **Real data adapters:** Cesium Ion terrain/imagery/buildings, OpenStreetMap, Tomorrow.io and Open-Meteo weather, EIA energy, NOAA NWPS hydrology, NWS hazards, Transitland discovery and configured GTFS-Realtime feeds. Each response retains source, freshness and fallback status; adapter availability is distinct from a successful live receipt.
- **AI runtime:** replaceable server-side model configuration, individual VÆLON/AUREN/SOLVÆR threads, TEAM contributions and explicit provider/model/fallback provenance. Groq is supported through the OpenAI-compatible adapter.
- **Quantum runtime:** local simulation plus IBM Quantum and D-Wave adapters. IBM hardware requires its service CRN and credentials; D-Wave hardware requires a Leap/SAPI token. Missing configuration is reported explicitly and never presented as hardware validation.
- **Evidence and tests:** validated synthetic microgrid fixtures, deterministic twin/scenario/solver results, decision receipts, provenance checks, browser acceptance tests and advisory human-review contracts.
- **CI:** root tests, blocking coverage, lint/format, JavaScript and frontend typechecks, fresh-clone and container smoke checks, packaging, release-readiness and CodeQL. The dedicated v4 web workflow builds the React workspace.

## Run the application surfaces

Use Node.js 22 and the committed lockfiles. In PowerShell, launch the canonical production application from the repository root:

```powershell
npm ci --ignore-scripts
npm run aethergrid-app
```

Open `http://localhost:8090` (or the configured application port). The launch command installs the locked React workspace, builds `web/dist/` and starts the Node backend, which serves the command center and same-origin APIs. A missing build produces `canonical_web_build_missing`; the server never silently substitutes the legacy interface.

For frontend development, keep the backend running and use a second terminal:

```powershell
cd apps/aethergrid-console/web
npm ci --ignore-scripts
npm run dev
```

Open the Vite URL (normally `http://localhost:5174`); its development API proxy connects to port 8090. See the [web workspace README](apps/aethergrid-console/web/README.md) for build and browser-test commands.

The React workspace has a separate lockfile and its own dependency security gate. Run `npm audit --audit-level=moderate --prefix apps/aethergrid-console/web` from the repository root (or `npm audit --audit-level=moderate` from inside the web workspace). The engineering and v4 web CI workflows block on that audit; root-only `npm audit` does not cover the web dependency graph.

`npm run package:aethergrid-app` builds and ships the same canonical React/Cesium application in `dist/aethergrid-functional-app.zip`; `npm run smoke:aethergrid-app` launches and probes that packaged runtime. Native v3 direct-open compatibility is explicitly packaged under `legacy/`. `npm start` runs the independent platform health service; `npm run operator-console` runs the earlier evidence console.

## Maintained repository surfaces

| Path | Implemented responsibility |
| --- | --- |
| `src/` | Digital-twin contracts, simulation, advisory decisions, evidence and health service |
| `apps/aethergrid-console/` | Node application backend, providers, AI/quantum runtime and legacy console |
| `apps/aethergrid-console/web/` | React/TypeScript/Cesium command center and Playwright tests |
| `apps/operator-console/` | Earlier maintained evidence console and brand assets |
| `tests/`, `fixtures/` | Root regression suites and deterministic fixtures |
| `scripts/` | Verification, demos, packaging and sanitized provider smoke tooling |
| `docs/` | Architecture, scope, provider contracts, roadmap and acceptance evidence |

## Verification and evidence

From a fresh clone, install Node.js 22, run `npm ci --ignore-scripts` in the repository root, then run `npm test`. The default root suite requires no provider credentials and uses injected adapters, local fixtures and loopback HTTP servers. No paid quantum job or physical infrastructure action is part of this suite. To prove the tests are independent of external provider access, run `npm run test:offline`; this clears provider credentials and rejects non-loopback TCP/TLS and `fetch` connections from the Node test processes, while allowing local fixture servers. It is an application-process guard, not a substitute for machine/container egress isolation.

For a focused example that exercises returned runtime data rather than matching source text:

```powershell
node --test tests/aethergrid-geo-runtime-behavior.test.mjs
```

These geospatial tests cover unit conversion and height precedence, voltage parsing, deterministic synthetic geometry with non-live provenance, input rejection before network access, and cache refresh using local provider fixtures. The full maintained verification path remains:

```powershell
npm test
npm run test:report
npm run test:offline
npm run coverage
npm run syntax
npm run lint
npm run typecheck
npm run typecheck:strict-renderer
npm run check
```

`npm run syntax` is cross-platform: it uses Node.js to inspect maintained JavaScript/ESM source, so the same command works in Windows PowerShell and Linux CI without GNU `find` or `xargs`. It skips installed dependencies and generated build artifacts.

[Engineering CI](.github/workflows/ci.yml), [v4 web CI](.github/workflows/aethergrid-v4-web.yml) and [CodeQL](.github/workflows/codeql.yml) bind results to tested commits. [Command-center acceptance evidence](docs/acceptance/aethergrid-command-center/README.md) distinguishes historical provider checks from final-main submission evidence. Credentialed tests are opt-in; an ordinary green test run is not proof of live provider or quantum hardware execution.

The final submission gate must run on one exact `main` SHA after canonical packaging and intended hardening are merged, followed by the protected canonical live-provider workflow and its sanitized artifact. [Release readiness](docs/RELEASE_READINESS.md) and [version scheme](docs/VERSIONING.md) define that boundary. No production hosting target is configured by repository Actions secrets alone.

## Environment configuration

The root `.env.example` configures the health service and mirrors the application's optional runtime variables without secrets. The application backend's [environment example](apps/aethergrid-console/.env.example) documents server-side provider configuration, legacy direct-provider overrides, and launcher controls. `AETHERGRID_SETUP_PASSWORD` is only for temporary account bootstrap and must never be saved with a value in a template or an on-disk runtime env file. Keep credentials in encrypted Actions secrets or an ignored deployment/runtime environment; never commit them. Public provider/runtime endpoints redact server credentials.

## Latest verified main evidence

Main `9c2957f51fff0c0a58d2d71bc492a8cc30599fbb` passed [canonical acceptance](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38508833100): 147 browser tests (3 skipped), followed by 2 credentialed Cesium tests. [Sanitized source receipts](https://github.com/DevNDesign-byMr-Zay/-THERGRID/actions/runs/38508833100/artifacts/11869564479) verify real AI specialist/TEAM responses, weather/forecast, EIA NYIS, NOAA BATN6, transit discovery, and 25 Cesium building tiles plus terrain/imagery. IBM passed authenticated discovery of three hardware backends; no hardware job was submitted or executed. The separate fifteen-minute replay passed on the source-identical final feature tree. See [rescore readiness](docs/RESCORE_READINESS.md) for boundaries and remaining work.

## Current status and future work

Backend/provider PR #145, React command-center PR #144, repository cleanup #147, canonical runtime/ZIP migration #148, spatial-first renderer work #158-#159, release reconciliation #161, acceptance hardening #162 and verified-main trigger #163 are integrated. Exact-main Engineering CI, CodeQL, canonical browser acceptance, live-provider checks and sanitized evidence completed successfully for the current 0.2.1 candidate on October 11, 2026. Production deployment configuration remains outstanding. The runtime stack, initial schemas, synthetic fixture and initial test/CI foundation are complete. [Roadmap](docs/ROADMAP.md) separates delivered work from future pilots and actuation research.

## Reproducible verification

THERGRID targets Node.js 22 and commits its lockfile so a fresh clone can reproduce the maintained quality path. The conventional application entrypoint is `npm start`, which runs `src/platform-health-service.mjs`.

```bash
npm ci --ignore-scripts
npm audit --audit-level=moderate
npm run syntax
npm run typecheck
npm run typecheck:strict-renderer
npm test
npm run coverage
npm run demo
npm run verify:release
```

`npm run demo` executes the deterministic synthetic-microgrid vertical slice and prints a compact evidence summary containing the snapshot, experiment, receipt, scene, render target, provenance result, promotion status, and the advisory SOLVÆR handoff state. The demo fails closed if simulation or provenance validation fails or if the promotion gate becomes authoritative.

Pull requests and pushes to `main` run the same reproducible install, dependency audit, release-readiness contract, syntax checks, test coverage, demo path, and container smoke test. CodeQL runs separately as the maintained static security-analysis gate. `npm run verify:release` confirms those maintained quality/security/safety gates are still present before a real semantic tag is cut; it does not claim that a release already exists.

`npm run typecheck:strict-renderer` applies TypeScript strict checking to the compact renderer evidence and no-actuation policy boundary. It retains the existing JavaScript migration's explicit `noImplicitAny: false` exception; broad strict-mode conversion is intentionally not claimed.

### Container startup

The canonical fresh-clone Compose file is `docker-compose.yml`:

```bash
docker compose -f docker-compose.yml up --build
```

This starts both the canonical ÆTHERGRID React/backend application at `http://127.0.0.1:8090` and the independent health service at `http://127.0.0.1:8080/health`. The frontend is built inside `Dockerfile.aethergrid`; the Node runtime serves same-origin APIs. Local profiles persist in the named `aethergrid-data` volume. Docker Compose 2.24+ is required for the optional environment file.

Provider credentials are optional for startup and must be supplied in an ignored `.env.aethergrid` file for live integrations. The image never contains those secrets. Without credentials, the application reports each provider's unavailable/fallback state. This command does not provision cloud infrastructure or certify every external provider. Ordinary local Node startup remains loopback-only; container binding is explicitly configured, and the app's published host port is restricted to loopback.

`aethergrid-container-smoke` verifies the compiled React root and JavaScript asset, application configuration/runtime APIs, health service, and profile persistence through a container restart. Docker is required for this route. The ZIP remains extract-and-launch; opening a ZIP or HTML cannot start backend processes.

## Coverage evidence

The blocking Node coverage gate now writes raw V8 coverage from the exact CI test run and retains it as a 30-day workflow artifact tied to the tested commit. Coverage thresholds are unchanged; the artifact adds reviewer-visible evidence without weakening the gate.

## Provider-neutral error reporting

`startPlatformHealthService()` accepts an optional `onError(error, context)` callback for connecting a deployment-specific error tracker without coupling THERGRID to one vendor SDK. Startup and configuration failures are reported with frozen, bounded context; reporter failures are isolated and never replace the original runtime error.

## Engineering rules

- Simulation before actuation. No direct real-world control surface until explicit safety, authorization, rollback, and human-approval contracts exist.
- Every recommendation must carry provenance: inputs, model/algorithm version, assumptions, confidence/constraints, and a stable receipt ID.
- Quantum work must always ship with a classical baseline and measurable comparison criteria.
- Keep provider-specific APIs behind adapters.
- Prefer small PRs with tests and clear acceptance criteria over broad speculative scaffolding.
- Never commit credentials, live customer/grid data, private keys, or environment secrets.
- Treat spatial/holographic UI as a consumer of stable scene contracts, not the source of grid truth.

## Provider runtime foundation (product generation v4)

The maintained server-side runtime includes a provider configuration registry that normalizes all external integrations (spatial, geospatial, weather, air quality, seismic, terrain, quantum, AI, energy, transit, and hydrology).

Key capabilities in this batch:
1. **Central Validated Environment Configuration**: `zod`-validated config schema supporting current and forward-compatible providers (Cesium, Tomorrow.io, Overture, EIA, D-Wave, NWS, transit, hydrology).
2. **Provider Registry**: Normalized readiness tracking (`ready`, `degraded`, `unconfigured`, `unavailable`, `fallback`).
3. **Secret Redaction**: Defensive credential redaction from runtime responses, logs, errors, and exports.
4. **Outbound Provider URL Policy**: Bounded outbound URL policy restricting server-side fetch calls to approved provider endpoints.
5. **Provider resilience**: Memory cache store, circuit breaker, and provider rate limiters.
6. **Safe Public Runtime Endpoint**: `GET /api/aethergrid/runtime/providers` exposing secret-redacted provider readiness metadata.

See [docs/PROVIDER-ARCHITECTURE.md](docs/PROVIDER-ARCHITECTURE.md) for full architectural specifications.

## Target architecture (not yet the current tree)

Future extraction into separate twin, optimization, simulation and audit services remains optional architecture work. Those services are currently implemented as maintained modules in the paths above. New directories should appear only when real code lands; the target decomposition does not describe missing application capabilities.

The protected [canonical live acceptance workflow](.github/workflows/aethergrid-canonical-live.yml) starts automatically after successful `main` CodeQL and also supports explicit dispatch. It requires the current exact `main` SHA and successful push runs of Engineering CI and CodeQL. It uses the `aethergrid-live-verification` environment restricted to `main` (existing administrator bypass retained), then checks all three Groq specialists and TEAM, Tomorrow.io observations/forecast, EIA NYIS, NOAA BATN6 observations, Transitland, NYC Ferry GTFS-Realtime, and actual Cesium terrain/imagery/building tiles through the packaged React runtime. Only sanitized JSON evidence is uploaded. IBM Quantum performs authenticated IAM + backend discovery when its API key and service CRN are configured, while hardware submission remains disabled in acceptance. D-Wave remains configuration-only until a Leap/SAPI token is installed. The earlier AUREN/configuration smoke workflow does not meet this canonical acceptance contract.
