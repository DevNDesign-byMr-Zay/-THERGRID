# ÆTHERGRID v4.0 Production Provider Architecture

## Overview

ÆTHERGRID v4.0 introduces a server-side provider runtime and configuration registry that normalizes all external integrations (spatial, geospatial, weather, air quality, seismic, terrain, quantum, AI, energy, transit, and hydrology).

The system follows a strict unidimensional flow:

```
process.env → validated config → provider registry → provider adapters → normalized runtime status
```

---

## Configuration & Secret Boundaries

1. **Central Validation (`apps/aethergrid-console/config/env-schema.mjs`)**:
   Uses `zod` to validate environment variables at server boot. Unconfigured or optional providers fall back safely without preventing application startup.

2. **Secret Safety (`apps/aethergrid-console/security/secret-redactor.mjs`)**:
   Credentials (API keys, tokens, CRN strings, auth headers) are registered during configuration loading and defensively stripped from:
   - Log output and error stack traces
   - Public runtime API responses
   - Evidence exports and serialized payloads
   - Standalone ZIP distribution assets

3. **Public vs. Private Configuration (`public-config.mjs` vs `provider-config.mjs`)**:
   - Private configuration contains actual connection strings and credentials (server-side only).
   - Public configuration exposes only non-sensitive boolean availability flags (`hardwareEnabled`, `configured`) and endpoint modes.
   - Endpoint `/api/aethergrid/runtime/providers` returns normalized public readiness metadata.

---

## Provider Lifecycle & Status States

Providers transition across normalized readiness states:
- `ready`: Fully configured and operational.
- `degraded`: Configured but encountering partial issues or missing optional parameters.
- `unconfigured`: Optional provider with no credentials or endpoint configured.
- `unavailable`: External service unreachable or circuit breaker open.
- `fallback`: Default offline/local implementation active (e.g. local quantum simulator, local AI runtime).

---

## Core Safety & Reliability Primitives

### 1. Outbound URL Policy (`apps/aethergrid-console/security/url-policy.mjs`)
Restricts server-side outbound HTTP requests strictly to pre-approved provider hostnames and validated local developer endpoints (e.g., local Ollama on `127.0.0.1`).

### 2. Provider Cache (`apps/aethergrid-console/providers/cache-store.mjs`)
In-memory request cache supporting TTL, stale state detection, retrieval timestamps, hit/miss metadata, and stale-while-revalidate semantics.

### 3. Circuit Breaker (`apps/aethergrid-console/providers/circuit-breaker.mjs`)
State machine (`CLOSED`, `OPEN`, `HALF_OPEN`) preventing repeated calls to failing upstream providers. Distinguishes timeouts, provider errors, and fallback activations.

### 4. Rate Limiting (`apps/aethergrid-console/providers/rate-limiter.mjs`)
Per-provider request budget enforcement to prevent exceeding API limits (e.g., IBM Quantum submission limits).

---

## Registering Future Provider Adapters

Future provider adapters (e.g., Cesium, Tomorrow.io, Overture, EIA, D-Wave) register with `providerRegistry` by defining:
1. Schema additions in `env-schema.mjs`.
2. A wrapped adapter invoking `getBreaker(id)`, `getRateLimiter(id)`, and `urlPolicy.validateUrl(...)`.
3. Capability registration via `providerHealth.registerProvider(id, { name, capabilities, status })`.


### 8. IBM Qiskit Quantum Worker (`services/quantum-worker/`)
- **Architecture**: External Python FastAPI worker service (`qiskit~=2.5.2`, `qiskit-ibm-runtime~=0.47.0`).
- **Capability**: `quantum`, `qiskit-transpilation`, `isa-circuit-preparation`
- **Endpoints**:
  - `POST /v1/prepare`: Transpiles OpenQASM 3 abstract circuits into backend-specific ISA circuits using preset pass managers, maps Estimator observables to physical layouts, and generates circuit metrics & evidence receipts.
  - `POST /v1/dry-run`: Executes preflight validation (`dry_run=True`) against IBM Quantum APIs without QPU hardware execution.
- **Safety Boundary**: Quantum worker operates strictly in `PREPARED` and `DRY_RUN_VALIDATED` states. QPU hardware submission requires explicit operator approval (`APPROVAL_REQUIRED`).

## Provider Status & Acceptance Classification

To ensure complete operational truth, all runtime providers are classified across four clear readiness categories:

1. **IMPLEMENTED / OPERATIONAL (No API Key Required)**:
   - Open-Meteo Weather (`open-meteo`)
   - Open-Meteo Air Quality (`open-meteo-air-quality`)
   - Open-Meteo Elevation (`open-meteo-elevation`)
   - USGS Seismic (`usgs`)
   - US National Weather Service Hazards (`nws`)
   - NOAA NWPS Hydrology (`noaa-nwps`)
   - OpenStreetMap / Overpass (`osm-overpass`)

2. **IMPLEMENTED / REQUIRES CREDENTIALS**:
   - Tomorrow.io Weather (`tomorrow-io`): Requires `AETHERGRID_TOMORROW_IO_API_KEY`
   - U.S. EIA Electricity Mix (`eia`): Requires `AETHERGRID_EIA_API_KEY`
   - Transitland Mobility Discovery (`transitland`): Requires `AETHERGRID_TRANSIT_API_KEY`
   - GTFS-Realtime Transit (`gtfs-rt-registry`): Configured via `AETHERGRID_GTFS_FEEDS_FILE` or `AETHERGRID_TRANSIT_FEEDS`
   - IBM Quantum Compute (`ibm-quantum`): Requires `AETHERGRID_IBM_QUANTUM_API_KEY` and `AETHERGRID_IBM_QUANTUM_SERVICE_CRN`
   - D-Wave Quantum Annealing (`dwave`): Requires `AETHERGRID_DWAVE_API_TOKEN` (`AETHERGRID_DWAVE_SOLVER_URL`)
   - Cesium 3D Tiles (`cesium`): Requires `AETHERGRID_CESIUM_ION_TOKEN`
   - Groq / OpenAI AI Runtime (`openai-compatible`): Requires `AETHERGRID_OPENAI_API_KEY`

3. **UNCONFIGURED**:
   - Optional providers without supplied deployment API keys or endpoints operate in safe fallback or unconfigured state without crashing the platform.

4. **FUTURE BATCHES**:
   - IBM Qiskit Transpilation Worker (Python microservice)
   - Overture Maps Semantic City Pipeline
