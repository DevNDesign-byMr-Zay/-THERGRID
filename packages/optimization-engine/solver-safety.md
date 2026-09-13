# Solver safety boundary

The optimization engine treats provider output as untrusted computation until it passes the result contract. A provider must return one binary decision for every problem variable and a finite objective value.

Normalization occurs before downstream comparison so equivalent quadratic terms have a deterministic representation. Validation does not imply physical correctness: domain-specific constraints and telemetry validation remain outside this reference layer.

The reference path is local and deterministic. Future quantum or quantum-inspired providers should use the same validation boundary and remain comparable with a classical reference before their output is considered operationally useful.
