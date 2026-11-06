# ÆTHERGRID — Open Quantum read-only integration

This optional integration performs authenticated **read-only backend discovery** using the official Open Quantum Python SDK. It does not prepare a quote, submit a job, deduct credits, or verify QPU execution. IBM Quantum, Qiskit Aer, the deterministic local demos, and D-Wave remain untouched.

## Credential setup

Use GitHub Actions repository secret `AETHERGRID_OPENQUANTUM_SDK_KEY_JSON` with the entire original SDK JSON (`client_id` and `client_secret`), or split secrets `OPENQUANTUM_CLIENT_ID` / `OPENQUANTUM_CLIENT_SECRET`. The manual workflow also recognizes `OPENQUANTUM_SDK_KEY_JSON` or `OPENQUANTUM_SDK_KEY` **when the GitHub secret contains the complete JSON** rather than a file path.

GitHub repository secrets are injected into Actions jobs only, **not automatically into an ÆTHERGRID installation or deployed service**. For local or hosted runtime, set `AETHERGRID_OPENQUANTUM_SDK_KEY_JSON` through the private process environment, or set `OPENQUANTUM_SDK_KEY` to the absolute path of a server-private SDK JSON file, or provide the two separate environment variables. Never use browser/`VITE_` variables.

Since a copy of the credential was uploaded into a chat, **rotate the SDK key** before production usage. Do not put the uploaded JSON into GitHub source, ZIP builds, public logs, evidence files or a frontend.

## Optional worker setup

The primary app remains Node.js 22. The isolated Open Quantum worker requires a separate Python environment and the pinned official SDK:

```powershell
py -m venv .venv-openquantum
.\.venv-openquantum\Scripts\python.exe -m pip install -r apps/aethergrid-console/requirements-openquantum.txt
$env:AETHERGRID_OPENQUANTUM_PYTHON = (Resolve-Path .\.venv-openquantum\Scripts\python.exe).Path
```

The Windows app ZIP includes the bridge but cannot silently install Python or configure GitHub repository secrets on a local PC. If the worker is missing, the new endpoint clearly reports `worker_unavailable` while local and IBM paths continue.

## Read-only API

- `GET /api/aethergrid/quantum/openquantum/runtime` — config presence, not connection proof.
- `GET /api/aethergrid/quantum/openquantum/status` — optional SDK installed/version.
- `GET /api/aethergrid/quantum/openquantum/backends` — authenticated live QPU discovery; no QPU jobs.

The selected default provider remains `local-simulator`. **Do not select `AETHERGRID_QUANTUM_PROVIDER=openquantum` yet**, because job execution/quote authorization has deliberately not been implemented in this first phase.

## Verification

Local tests need no credentials or network:

```shell
node --test tests/aethergrid-openquantum-runtime.test.mjs
python -m py_compile apps/aethergrid-console/openquantum-bridge.py
```

The manual `Open Quantum read-only discovery` GitHub Actions workflow runs only via `workflow_dispatch` from a trusted branch. It injects GitHub repository secrets for discovery and prints only public backend fields. Its successful result establishes authenticated discovery — **not available credit balance or successful hardware execution**.

Next PR: approved QASM transpilation, quote-only preflight, maximum Spark credit budget, operator confirmation, signed receipt/job status and results before adding a real hardware submit button. Hardware jobs must never run automatically in ordinary CI.

Docs: https://docs.openquantum.com/core-sdk/backend-discovery/ and https://docs.openquantum.com/concepts/credits/.
