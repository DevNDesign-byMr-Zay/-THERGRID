# VÆLON collaboration boundary

VÆLON joins THERGRID as an intelligence/experimentation layer, not as the source of grid truth.

## Working contract

- THERGRID owns validated telemetry, deterministic twin state, simulation evidence, and safety policy.
- VÆLON may propose scenarios, rank optimization experiments, explain trade-offs, and annotate spatial views.
- Every VÆLON request/result carries model identity, capability, safety class, fallback identity, and audit metadata.
- Classical deterministic computation remains the reference path whenever an advanced model is unavailable.
- No model route exposes a physical actuation capability in the foundation phase.

## Handoff to SOLVÆR

SOLVÆR should join through the same provider-neutral boundary rather than creating a second orchestration path. The preferred division is:

`VÆLON -> experiment/optimization intent -> THERGRID contracts -> SOLVÆR solver/analysis -> deterministic comparison -> receipt`

This keeps the intelligence family composable while preserving one authoritative twin and safety plane.

## Further ideas for the team

1. Add a capability registry generated from versioned contracts so new intelligence agents can self-describe without changing the twin engine.
2. Add scenario fingerprints so identical inputs, model versions, seeds, and constraints map to reproducible experiment identities.
3. Add a provenance graph linking telemetry -> twin state -> forecast -> proposal -> simulation -> receipt -> spatial scene.
4. Add adversarial evaluation fixtures for stale telemetry, impossible units, hallucinated asset values, solver timeout, and fallback activation.
5. Add a renderer-neutral spatial diff so an operator can compare two scenarios in 3D without coupling the comparison to a holographic vendor.
6. When SOLVÆR arrives, benchmark it against the existing classical and quantum-inspired baselines before allowing its output into any recommendation ranking.
