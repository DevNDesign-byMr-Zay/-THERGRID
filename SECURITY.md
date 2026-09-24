# Security Policy

## Supported surface

Security maintenance applies to the maintained THERGRID runtime under `src/`, tests and scripts, dependency manifests/lockfiles, container runtime, operator/read-model evidence, renderer-neutral scene contracts, and CI/release automation.

No current maintained path is authorized to perform physical grid actuation.

## Reporting a vulnerability

Do not open a public issue containing credentials, private infrastructure details, customer/grid telemetry, control tokens, private keys, or exploit details that could expose a real deployment.

Use GitHub private vulnerability reporting when available. Otherwise, contact the repository owner privately through an existing trusted channel and provide:

- the affected module or trust boundary;
- a minimal reproducer;
- expected versus observed behavior;
- whether stale/cross-object identity, solver evidence, promotion, renderer, or authorization boundaries are involved; and
- any known safe mitigation.

## High-risk boundaries

Security review is required for changes that affect:

- request, snapshot, experiment, receipt, or provenance identity;
- solver comparison and fallback evidence;
- promotion eligibility or authorization semantics;
- operator attention and source asset/node scope;
- renderer packets or scene-to-device negotiation;
- health/status surfaces exposed by the container runtime; or
- release and dependency-verification automation.

Every such change should include a focused regression proving the unsafe path fails closed.

Never lower a security, coverage, audit, or validation threshold merely to make a change pass.
