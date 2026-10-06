# Project Scope

ÆTHERGRID / THERGRID is a maintained **application platform with a Node.js backend and React/TypeScript/Cesium frontend**, not an infrastructure-as-code repository.

The operator application backend is `apps/aethergrid-console/server.mjs`, and the React/TypeScript command center and Cesium engine live under `apps/aethergrid-console/web/`. Provider adapters, AI-agent orchestration and quantum runtime modules live beside that backend. Its independent platform health-service entrypoint is `src/platform-health-service.mjs` (executed via `npm start`), with core application logic under `src/`, tests under `tests/`, maintained verification/demo tooling under `scripts/`, and architecture/provider/acceptance evidence under `docs/`. The Dockerfile and `docker-compose.yml` reproduce and smoke-test the application runtime; they are packaging and verification assets, not Terraform, Kubernetes, Helm, Pulumi, Ansible, or another infrastructure provisioning product.

## Primary application concerns

- validated digital-twin and energy-simulation contracts;
- advisory spatial-intelligence and operator-review surfaces;
- provenance, evidence packages, runtime health, observability, and bounded error reporting;
- deterministic demos and reproducible fresh-clone verification.

## Explicit non-goals

THERGRID does not currently provision cloud infrastructure, manage remote state, declare Kubernetes resources, or expose infrastructure mutation authority. Do not classify the repository as infrastructure-as-code solely because it contains Docker/Compose files.

The root `.repo-class.json` mirrors this boundary and release-readiness verification keeps it from drifting.
