# Testing and verification

ÆTHERGRID's maintained release path has **two independent forms of evidence**: deterministic engineering checks (runnable without external credentials) and opt-in live-provider acceptance (requires current credentials and working upstream services). Do not interpret a green offline run as proof of a live AI response, real Cesium ion tiles, or quantum hardware execution.

## Test matrix

| Layer | Run locally | CI ownership | Establishes |
| --- | --- | --- | --- |
| Root Node contracts/integration | `npm test` | `engineering/ci` → `test` and `quality` | Digital twin, Node APIs, provider adapters, safety and evidence contracts |
| Root Node JUnit report | `npm run test:report` | `engineering/ci` → `test` | The same Node test suite with console output and machine-readable `test-results/node-tests.xml` |
| Blocking Node coverage | `npm run coverage` | `engineering/ci` → `coverage` and `quality` | Node test coverage at **84% lines, 70% branches, 85% functions** minimum |
| JavaScript syntax, lint, type and format | `npm run syntax`, `npm run lint`, `npm run typecheck`, `npm run typecheck:strict-renderer`, `npm run format:check` | `engineering/ci` | Maintained application boundaries are structurally valid |
| Full local quality chain | `npm run check` | `engineering/ci` → `fresh-clone-smoke`, `quality` | Release-readiness rules, canonical ZIP/package smoke, Node tests/coverage and demos |
| React/TypeScript frontend | `cd apps/aethergrid-console/web; npm ci; npm run typecheck; npm run build` | `aethergrid/v4-web` | Canonical application compiles and static assets are bundled |
| React/Cesium browser acceptance | `cd apps/aethergrid-console/web; npx playwright install chromium; npm test` | `aethergrid/v4-web` and protected canonical acceptance | Operator interaction, real browser rendering and fallback contracts |
| Container runtime | `docker compose -f docker-compose.yml up --build` | `engineering/ci` container smoke jobs | Backend, frontend and health service startup/persistence |
| Security | CodeQL and `npm audit --audit-level=moderate` | `security/codeql`, `engineering/ci` | Static security review and dependency advisories |
| Protected live acceptance | `.github/workflows/aethergrid-canonical-live.yml` | exact-`main` workflow after Engineering CI and CodeQL | Fresh, source-backed receipt evidence from configured providers; failures are not silently downgraded |

## Local Node commands

The root requires Node **22** and a lockfile install:

```powershell
npm ci --ignore-scripts
npm test
npm run test:report
npm run coverage
npm run check
```

The suite is maintained under `tests/`, including nested `tests/js/` tests, and continues to run via the same explicit file patterns in each command. `npm run test:report` uses Node's built-in reporters to write JUnit XML under the ignored `test-results/` directory while streaming `spec` output; test failures still produce a failing exit status. It does **not** adjust the coverage script. GitHub Actions uploads XML (test job) and raw V8 coverage (coverage job) as separate retained artifacts. No XML is pre-generated or checked into Git.

For PowerShell on Windows, `npm run test:report` automatically creates `test-results/` before the command starts. The result is not a browser test report; browser acceptance runs in the web workspace.

## Runtime selection and browser verification

- **Canonical product:** `npm run aethergrid-app`; the server builds and serves `apps/aethergrid-console/web/dist/` at `http://localhost:8090`.
- **Health application:** `npm start` runs `src/platform-health-service.mjs`, not the 3D command center.
- **Frontend development:** use `npm run dev` inside `apps/aethergrid-console/web` with the Node backend available.
- **Legacy:** `apps/aethergrid-console/app.js` is compatibility code shipped under `legacy/` in the functional archive, **not** the canonical UI.
- **Functional ZIP:** `npm run package:aethergrid-app`, then `npm run smoke:aethergrid-app`. Extracting and launching the packaged scripts starts the backend; opening `index.html` alone cannot start Node services.

The browser suite exercises the Cesium production renderer plus the native WebGL fallback. Browser success on a token-free or software-rendered environment validates fallbacks and operator UX, not real Cesium ion tile delivery. See [web workspace guide](../apps/aethergrid-console/web/README.md).

## Provider states and assertions

The server registry reports `ready`, `degraded`, `unconfigured`, `unavailable`, or `fallback`. A readiness state is not proof that a particular provider request succeeded. A source-backed result must include provider, source time, freshness and fallback metadata. Hardware claims require actual verified provider-returned execution results; authenticated IBM backend discovery is not a QPU job. A missing D-Wave token means **unconfigured**, not hardware validated.

Use [provider architecture](PROVIDER-ARCHITECTURE.md) and [acceptance evidence](acceptance/aethergrid-command-center/README.md) to distinguish recorded successful observations from the latest run. The [protected live workflow](../.github/workflows/aethergrid-canonical-live.yml) runs only with the configured environment and exact current `main` SHA. Failure caused by upstream outages, quotas, bad credentials or missing configuration must remain visible as a failed/incomplete live acceptance result; it does not erase deterministic test results.

## Interpreting an artifact

- Check the workflow URL, run conclusion and source commit SHA.
- For Node tests, inspect `node-test-results` and the `test` job, not a count inferred from filenames.
- For coverage, inspect the `coverage` / `quality` job and the raw `runtime-v8-coverage-<sha>` artifact. Thresholds are enforced during the run.
- For real-world providers, inspect only sanitized acceptance JSON tied to that same SHA, including the distinction between **verified**, **fallback**, **degraded** and **unconfigured**.
- Never compare test totals across suites without noting whether they include skipped browser cases.

No test or provider check can authorize physical infrastructure actuation. All proposals remain advisory and require stable provenance and human review.
