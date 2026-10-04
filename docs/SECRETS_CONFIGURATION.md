# ÆTHERGRID secret configuration

ÆTHERGRID keeps credential values outside Git history.

## Local development

1. Copy `apps/aethergrid-console/.env.secrets.example` to `apps/aethergrid-console/.env.secrets`.
2. Fill only the local `.env.secrets` copy.
3. Load that file into the server process using the deployment/runtime mechanism for the environment.
4. Never commit `.env.secrets`, `secrets.env`, exported credentials, or provider tokens.

The repository-level `.gitignore` explicitly excludes these files.

## GitHub / hosted deployment

Use encrypted GitHub Actions or deployment secrets for credential values. Keep non-secret provider base URLs in normal configuration.

Recommended secret names:

| Integration | ÆTHERGRID secret/config |
| --- | --- |
| Cesium ion | `AETHERGRID_CESIUM_ION_TOKEN` |
| Tomorrow.io | `AETHERGRID_TOMORROW_IO_API_KEY` |
| U.S. EIA | `AETHERGRID_EIA_API_KEY` |
| Transitland | `AETHERGRID_TRANSITLAND_API_KEY` |
| IBM Quantum | `AETHERGRID_IBM_QUANTUM_API_KEY` |
| IBM Quantum instance | `AETHERGRID_IBM_QUANTUM_SERVICE_CRN` |
| D-Wave | `AETHERGRID_DWAVE_API_TOKEN` |
| OpenAI-compatible AI key | `AETHERGRID_OPENAI_API_KEY` |

## Groq

The existing AI runtime can use Groq through its OpenAI-compatible path:

```dotenv
AETHERGRID_AI_PROVIDER=openai-compatible
AETHERGRID_AI_MODEL=openai/gpt-oss-20b
AETHERGRID_OPENAI_BASE_URL=https://api.groq.com/openai/v1
AETHERGRID_OPENAI_API_KEY=<encrypted Groq key>
```

The key remains server-side. Groq documents `https://api.groq.com/openai/v1` as its OpenAI-compatible base URL.

## Transitland

Use Transitland as a feed-discovery/catalog integration, not as a replacement for the source GTFS-Realtime feed registry.

```dotenv
AETHERGRID_TRANSITLAND_BASE_URL=https://transit.land/api/v2/rest
AETHERGRID_TRANSITLAND_API_KEY=<encrypted Transitland key>
```

Transitland supports the `apikey` header/query parameter. Prefer the header so credentials do not enter URLs or logs.

## IBM Quantum

The IBM Quantum API key alone is not sufficient for the current hardware integration. A configured IBM Quantum instance/service CRN is also required:

```dotenv
AETHERGRID_IBM_QUANTUM_API_KEY=<encrypted key>
AETHERGRID_IBM_QUANTUM_SERVICE_CRN=<instance CRN>
```

Until both are present, runtime status must remain unconfigured for IBM hardware.

## Cesium ion

Do not commit an ion token. For hosted browser use, create an application-specific token with the minimum required scopes and restrict its allowed URLs/assets. The Cesium default token is appropriate for development convenience but should not be treated as the production credential.

## Public/no-key providers

These integrations do not require a secret in the standard public configuration:

- Open-Meteo weather
- Open-Meteo air quality
- Open-Meteo elevation
- USGS earthquake feed
- National Weather Service
- NOAA NWPS
- OpenStreetMap / Overpass

## Safety contract

- Credentials never appear in `ui.json`, `app.json`, public runtime metadata, browser diagnostics, evidence exports, or provider acceptance artifacts.
- Provider status `configured` is not equivalent to `live`.
- Live acceptance must redact provider errors before writing reports.
- Quantum discovery may be automated; hardware job submission remains explicit operator action.
