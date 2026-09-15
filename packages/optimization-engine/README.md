# Optimization Engine

The optimization engine keeps a classical exact reference alongside provider-neutral candidate execution. Benchmark receipts are measurement evidence: they bind the evaluated QUBO inputs, solver configuration, backend identities, objectives, and comparison metadata to a SHA-256 measurement fingerprint.

Receipt creation clones caller-owned QUBO inputs and deeply freezes the issued evidence. Validation recomputes the fingerprint and rejects structural or cryptographic drift before evidence crosses a package boundary.

Quantum-inspired candidates are evaluated against the maintained classical reference; candidate superiority is never assumed from backend identity alone.
