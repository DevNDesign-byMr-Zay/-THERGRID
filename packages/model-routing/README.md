# Model-routing boundary

The VÆLON↔AUREN handoff is a versioned computation envelope. Requests identify a capability and carry an explicit QUBO problem; results carry solver identity and reproducibility evidence.

The boundary validates shape and numeric safety before data crosses between layers. It does not grant actuation authority, mutate telemetry, expose model internals, or require a remote quantum service.

Future solver providers can evolve independently as long as they continue to satisfy the same computational result boundary and remain measurable against an appropriate classical reference.
