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
