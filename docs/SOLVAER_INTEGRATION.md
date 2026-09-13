# SOLVÆR integration boundary

SOLVÆR joins THERGRID through an explicit, simulation-bound optimization contract.

## Handoff

`THERGRID experiment -> SOLVÆR optimization request -> candidate -> THERGRID simulation -> decision evidence`

The request is anchored to the originating `experimentId`, `snapshotId`, and twin-state reference. A candidate may propose an optimization, but it cannot become an operating command through this interface.

## Required evidence

A candidate accepted by the contract must remain associated with:

- the originating experiment
- the originating snapshot
- a provenance reference
- the THERGRID proposal/simulation path
- a resulting decision receipt when decision evidence is requested

## Safety boundary

The integration is advisory and non-authoritative. `actuatesHardware` remains false, and candidate acceptance is not promotion approval. THERGRID simulation remains the gate before decision evidence is considered.

## Renderer boundary

Holographic render packets are independently validated and bound to the experiment and decision receipt. SOLVÆR optimization results do not bypass renderer validation, provenance validation, or presentation safety policy.

## First collaboration targets

1. Compare candidate objective against the classical reference baseline.
2. Route every candidate through the existing simulation gateway.
3. Produce decision evidence from the simulated candidate path.
4. Preserve deterministic experiment and artifact identities.
5. Add adversarial tests for cross-experiment, cross-snapshot, and provenance mismatches.
