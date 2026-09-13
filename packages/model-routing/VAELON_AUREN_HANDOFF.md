# VÆLON ↔ AUREN evidence handoff

The routing seam exposes computation as a bounded capability rather than a solver dependency. AUREN can consume the resulting evidence without importing VÆLON implementation details.

The handoff records the request identifier, contract version, capability, completion status, backend, algorithm, seed, objective, and optional duration. Missing solver evidence remains explicit rather than being inferred.

This surface is observational: it does not authorize actuation, mutate telemetry, or become system truth. AUREN remains responsible for orchestration and downstream policy decisions.
