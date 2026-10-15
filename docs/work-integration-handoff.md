# ÆTHERGRID — Backend API Integration Handoff & Contract Specification

**Version:** 2.6.0
**Target Branches / PRs:** Work PRs #166, #167, #169, #170, #171
**Base Server Entrypoint:** `apps/aethergrid-console/server.mjs`

---

## 1. Authentication & Session API

### Session Discovery

- **Path:** `GET /api/aethergrid/auth/session`
- **Headers:** `Authorization: Bearer <token>` or Cookie `aethergrid_session=<token>`
- **Response Schema (`200 OK`):**

```json
{
  "authenticated": true,
  "session": {
    "token": "ag_sess_...",
    "user": {
      "id": "user-operator",
      "username": "operator",
      "role": "operator",
      "displayName": "Operator"
    },
    "createdAt": "2025-10-13T06:00:00.000Z",
    "expiresAt": "2025-10-14T06:00:00.000Z"
  },
  "profile": {
    "id": "local-operator",
    "displayName": "Operator",
    "initials": "IM",
    "title": "ÆTHERGRID Operator",
    "homeRegion": "New York Metro"
  }
}
```

### Login

- **Path:** `POST /api/aethergrid/auth/login`
- **Request Body:**

```json
{
  "username": "operator",
  "password": "<AETHERGRID_OPERATOR_PASSWORD>",
  "role": "operator"
}
```

- **Response Schema (`200 OK`):** `Set-Cookie: aethergrid_session=...`

```json
{
  "success": true,
  "session": { "token": "ag_sess_...", "user": { "role": "operator" } }
}
```

---

## 2. 4D Temporal & Historical Observations API

### Historical Time Window Query

- **Path:** `GET /api/aethergrid/historical?lat=40.7128&lon=-74.006&startTime=2025-10-12T00:00:00Z&endTime=2025-10-13T00:00:00Z`
- **Response Schema (`200 OK`):**

```json
{
  "schemaVersion": 2,
  "coordinate": { "lat": 40.7128, "lon": -74.006 },
  "available": true,
  "timeWindow": {
    "startTime": "2025-10-12T00:00:00.000Z",
    "endTime": "2025-10-13T00:00:00.000Z"
  },
  "validTimeBoundary": {
    "min": "2000-01-01T00:00:00Z",
    "max": "2025-10-13T06:31:00.000Z"
  },
  "observations": [
    {
      "validTime": "2025-10-12T00:00:00.000Z",
      "temperatureC": 18.2,
      "relativeHumidityPercent": 62,
      "surfacePressureHpa": 1013.25,
      "windSpeedKph": 14,
      "sourceTimestamp": "2025-10-11T23:55:00.000Z"
    }
  ],
  "receipt": {
    "provider": "Open-Meteo Historical / Persisted Observations",
    "capability": "historical-4d-playback",
    "dataset": "replayed-city-environment",
    "live": true,
    "fallback": false,
    "retrievedAt": "2025-10-13T06:31:00.000Z"
  }
}
```

---

## 3. Provider Readiness & Health API

- **Path:** `GET /api/aethergrid/runtime/providers`
- **Response Schema (`200 OK`):** Lists configured providers, circuit breaker statuses, and readiness without exposing API tokens or secrets.

---

## 4. Required Environment Variables

| Variable                       | Description                                     |
| ------------------------------ | ----------------------------------------------- |
| `PORT`                         | Backend server HTTP port (default: `3000`)      |
| `AETHERGRID_OPERATOR_PASSWORD` | Password for operator login                     |
| `TOMORROW_IO_API_KEY`          | Weather provider key                            |
| `EIA_API_KEY`                  | Grid electricity API key                        |
| `TRANSITLAND_API_KEY`          | Transitland v2 discovery key                    |
| `GROQ_API_KEY`                 | LLM agent model key (fallback active if absent) |

---

## 5. Failure & Fallback Policy

- Upstream network errors automatically transition provider status to `stale` or `fallback: true` in provenance receipts.
- All response schemas include `provenance` and `receipt` fields identifying whether data is `live: true` or `fallback: true`. No synthetic data is represented as live.
