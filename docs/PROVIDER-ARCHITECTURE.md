# ÆTHERGRID v4.0 Production Provider Architecture

## Overview

ÆTHERGRID v4.0 establishes a server-side provider runtime and configuration registry that normalizes all external integrations (spatial, geospatial, weather, air quality, seismic, terrain, quantum, AI, energy, transit, and hydrology).

The system follows a strict unidimensional flow:

```
process.env → validated config → provider registry → provider adapters → normalized runtime status
```

---

## Implemented Provider Adapters

1. **Weather & Climate**:
   - `open-meteo-weather`: Current weather and 7-day hourly forecast.
   - `tomorrow-io`: Tomorrow.io weather API with realtime observations and forecast time-series.
   - `nws`: US National Weather Service active hazard alerts with zero-alert live source responses.

2. **Hydrology**:
   - `noaa-nwps`: NOAA National Water Prediction Service gauge metadata and stageflow observations/forecasts governed through independent execution.

3. **Energy & Grid Generation**:
   - `eia`: U.S. EIA Electricity Fuel Mix API v2 with explicit region validation and truthful null (non-zero) missing value normalization.

4. **Transit & Mobility**:
   - `gtfs-rt-registry`: GTFS-Realtime Transit Feed Registry with native binary Protocol Buffer (`FeedMessage`) decoding for VehiclePosition, TripUpdate, and Alert. Uses dynamic server-side feed configuration without hardcoded city defaults.

5. **Quantum Annealing**:
   - `dwave`: D-Wave Ocean SAPI v3 Quantum Annealing provider supporting explicit action lifecycle (`discover`, `submit`, `status`, `result`) with operator confirmation boundaries.
   - `ibm-quantum`: IBM Quantum Compute service integration.

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

## Provider Health & Truthful Cache Semantics

Providers transition across normalized readiness states:
- `ready`: Fully configured and operationally verified via upstream success.
- `degraded`: Configured but encountering partial issues, rate limiting, or returning stale cached data.
- `unconfigured`: Optional provider with no credentials or endpoint configured.
- `unavailable`: External service unreachable, timing out, or circuit breaker open.
- `fallback`: Default offline/local implementation active.

### Health Truth Principles
- `lastLiveSuccessAt` updates **ONLY** after a genuine verified upstream provider success (`upstreamSuccess`).
- A **fresh cache hit** preserves existing `lastLiveSuccessAt` and does not imply a new provider check.
- A **stale cache hit** sets status to `degraded` and does not set provider `ready`.
- A **fallback** sets status to `fallback` and never sets provider `ready`.

---

## Core Safety & Reliability Primitives

### 1. Outbound URL Policy (`apps/aethergrid-console/security/url-policy.mjs`)
Restricts server-side outbound HTTP requests strictly to pre-approved provider hostnames (`api.open-meteo.com`, `api.tomorrow.io`, `api.weather.gov`, `api.eia.gov`, `api.water.noaa.gov`, `sapi.qpu.dwavesys.com`, etc.) and validated local developer endpoints (`127.0.0.1`).

### 2. Provider Cache & SWR (`apps/aethergrid-console/providers/cache-store.mjs` & `provider-executor.mjs`)
In-memory request cache supporting explicit TTL, cache bypass policies for mutation calls, retrieval timestamps, hit/miss metadata, and governed stale-while-revalidate background refresh.

### 3. Circuit Breaker (`apps/aethergrid-console/providers/circuit-breaker.mjs`)
State machine (`CLOSED`, `OPEN`, `HALF_OPEN`) preventing repeated calls to failing upstream providers. Distinguishes timeouts, provider errors, and fallback activations.

### 4. Rate Limiting (`apps/aethergrid-console/providers/rate-limiter.mjs`)
Per-provider request budget enforcement to prevent exceeding API limits.
