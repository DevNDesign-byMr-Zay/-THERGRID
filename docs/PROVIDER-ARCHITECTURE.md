# ÆTHERGRID v4.0 Production Provider Architecture & Execution Layer

## Overview

ÆTHERGRID v4.0 features a validated server-side provider execution layer that normalizes external integrations (spatial, geospatial, weather, hazards, air quality, seismic, terrain, quantum, AI, energy, transit, and hydrology).

The execution layer enforces a unified pipeline:

```text
Validated ENV
    ↓
Provider Config
    ↓
Provider Registry
    ↓
Provider Adapter
    ↓
URL Policy
    ↓
Rate Limiter
    ↓
Circuit Breaker
    ↓
Cache
    ↓
External Provider
    ↓
Normalizer
    ↓
Provenance Receipt
    ↓
ÆTHERGRID API
```

---

## Configuration & Secret Boundaries

1. **Central Validation (`apps/aethergrid-console/config/env-schema.mjs`)**:
   Schema-validated configuration using `zod`. Optional providers remain non-blocking for fresh clones and offline execution.

2. **Secret Safety (`apps/aethergrid-console/security/secret-redactor.mjs`)**:
   Credentials (API keys, tokens, CRN strings, auth headers) are defensively redacted from log output, error stack traces, public responses, evidence exports, and packaged standalone ZIP assets.

3. **Public Configuration Bridge (`GET /api/aethergrid/config/public`)**:
   Exposes safe browser-readable settings (such as client Cesium tokens) while strictly redacting server secrets (IBM keys, OpenAI keys, Tomorrow.io keys, D-Wave tokens, etc.).

---

## Provider Adapters & Provenance Receipts

All adapters produce normalized data accompanied by a `providerReceipt`:

```json
{
  "provider": "open-meteo",
  "dataset": "weather-realtime",
  "requestId": "req-a1b2c3d4",
  "retrievedAt": "2026-04-15T12:00:00.000Z",
  "observedAt": "2026-04-15T12:00:00.000Z",
  "modelRunAt": null,
  "expiresAt": null,
  "cacheState": "hit",
  "live": true,
  "stale": false,
  "fallback": false,
  "attribution": "Open-Meteo"
}
```

### Implemented Adapters
- **OpenStreetMap / Overpass**: Geo / city geometry layer.
- **Open-Meteo & Tomorrow.io**: Weather & Air Quality providers.
- **USGS**: Earthquake & seismic feed.
- **Copernicus DEM / Open-Meteo**: Terrain & elevation provider.
- **NWS (`api.weather.gov`)**: Active US hazard alerts (`GET /api/aethergrid/hazards/alerts`).
- **U.S. EIA API v2**: Regional energy context and generation mix (`GET /api/aethergrid/energy/context`).
- **NOAA / NWPS**: River stage and flood hydrology provider (`GET /api/aethergrid/hydrology/gauges`).
- **D-Wave Systems**: Quantum annealing workload adapter & local classical annealer fallback.
- **IBM Quantum**: IAM authentication, backend discovery, Sampler, Estimator, and QPU safety boundary.
- **GTFS-RT Transit Registry**: City-specific transit feed registry (`GET /api/aethergrid/transit/vehicles`).
