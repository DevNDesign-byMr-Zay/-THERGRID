# Project Scope

THERGRID is a maintained **Node.js application service**, not an infrastructure-as-code repository.

Its executable surface lives under `src/`, with tests under `tests/` and maintained verification/demo tooling under `scripts/`. The Dockerfile and `docker-compose.yml` reproduce and smoke-test the application runtime; they are packaging and verification assets, not Terraform, Kubernetes, Helm, Pulumi, Ansible, or another infrastructure provisioning product.

## Primary application concerns

- validated digital-twin and energy-simulation contracts;
- advisory spatial-intelligence and operator-review surfaces;
- provenance, evidence packages, runtime health, observability, and bounded error reporting;
- deterministic demos and reproducible fresh-clone verification.

## Explicit non-goals

THERGRID does not currently provision cloud infrastructure, manage remote state, declare Kubernetes resources, or expose infrastructure mutation authority. Do not classify the repository as infrastructure-as-code solely because it contains Docker/Compose files.

The root `.repo-class.json` mirrors this boundary and release-readiness verification keeps it from drifting.
