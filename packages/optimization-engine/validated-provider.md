# Validated provider boundary

`createValidatedProvider` makes provider output cross the solver-result validation boundary before it is returned to callers.

This is intentionally a small adapter: provider execution remains provider-owned, while malformed decision vectors and non-finite objectives are rejected centrally. A future quantum or quantum-inspired provider can use the same wrapper without receiving additional authority over telemetry or actuation.
