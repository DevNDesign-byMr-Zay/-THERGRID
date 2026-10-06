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


---

## GTFS-Realtime Production Feed Registry

Production GTFS-Realtime feeds are configured server-side with `AETHERGRID_GTFS_FEEDS_FILE`.

The referenced JSON document uses schema version 1 and maps one enabled feed to each city ID supported by the current runtime. A maintained example is available at `docs/gtfs-feeds.example.json`.

Authentication values are never embedded in the JSON. A feed may name an `authHeaderEnv` environment variable; the server resolves that variable at startup and keeps the resulting authorization value private.

At startup ÆTHERGRID:

1. validates the registry document;
2. ignores disabled feed entries;
3. resolves any authorization header from the named server environment variable;
4. adds only the validated feed origins to the outbound URL allowlist;
5. registers the feeds with the GTFS-Realtime decoder/runtime;
6. reports only safe counts and configuration state through `/api/aethergrid/runtime/providers`.

A missing registry path or missing registry file degrades to an unconfigured transit provider rather than making the application fail to start. Malformed configured documents fail validation so unsafe or ambiguous feeds are not silently accepted.

The current production contract intentionally permits one enabled feed per city. Multi-feed aggregation remains a separate follow-up so it can be implemented explicitly without changing the established single-feed behavior or inventing cross-agency merge semantics.

---

## Provider Implementation Status Taxonomy

Providers in ÆTHERGRID are explicitly classified across five status tiers:

### 1. IMPLEMENTED / NO CREDENTIAL
- **Open-Meteo Weather**: Live weather observations, forecasts, air quality, and terrain elevation.
- **USGS**: USGS Earthquake GeoJSON Feed.
- **NWS**: National Weather Service active alerts and hazards.
- **NOAA NWPS**: Hydrology river gauge observations (gauge-specific ID required).
- **OSM / Overpass**: OpenStreetMap 3D spatial building footprint mesh data.

### 2. IMPLEMENTED / REQUIRES CREDENTIAL
- **Tomorrow.io**: Weather realtime and forecast (API key required).
- **EIA**: U.S. Energy Information Administration electricity grid fuel mix (API key required).
- **Transitland**: Transitland v2 REST API feed/agency discovery catalog (API key required; `apikey` header authentication).
- **GTFS-Realtime**: Production binary transit feed decoder (`AETHERGRID_GTFS_FEEDS_FILE` required).
- **Groq / OpenAI-compatible**: AI runtime agent completions (API key required).
- **D-Wave**: Ocean SAPI Quantum Annealing solver discovery & optimization (API token required).
- **Cesium**: Cesium Ion 3D tile asset streaming (client Ion token required).

### 3. PARTIALLY CONFIGURED
- **IBM Quantum**: API key provided without Service CRN yields `instance_required` status. Hardware readiness requires both API key AND Service CRN.

### 4. UNCONFIGURED
- Optional credential-backed providers when credentials or endpoints are absent. Falling back safely without preventing application startup.

### 5. FUTURE / RESEARCH
- Qiskit direct worker or specialized Python QPU execution modules.
