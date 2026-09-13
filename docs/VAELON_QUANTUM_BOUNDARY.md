# VÆLON quantum boundary

VÆLON's quantum work begins as an experimental optimization layer, not an authority over grid state or physical infrastructure.

The reference backend exists to make future quantum and quantum-inspired approaches measurable. Every solver result should retain enough metadata to reproduce and compare the experiment: backend, algorithm, version, seed, inputs, objective, and runtime where available.

## Progression

1. Deterministic classical reference.
2. Quantum-inspired algorithms that can run locally.
3. Provider-neutral adapter contracts.
4. Optional remote simulators or quantum hardware providers.
5. Comparative benchmarks on representative microgrid optimization problems.

A later quantum provider must never silently replace the reference solver. The classical baseline remains the control group for every claimed improvement.
