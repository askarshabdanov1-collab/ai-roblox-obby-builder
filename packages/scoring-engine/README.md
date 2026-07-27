# `@obby/scoring-engine`

Phase E1c deterministic report assembly and rendering foundation.

The package applies result precedence in this order: catalog invariant failure, incomplete required
evidence, profile-specific failure, warning, then pass. Every invariant declared by the verified
MetricCatalog must be evaluated exactly once, and every category in the verified E1 ScoringProfile
must remain present with the same metric set. E1 reports always declare `aggregateScore: false`.

`finalizeE1Report` produces a content-addressed payload with no execution ID or timestamp.
`renderMarkdownReport` produces a separately hashed renderer artifact whose bytes never contain
their own render hash. `applyAvailabilityRecords` preserves the original report and creates a new
derived report linked to immutable availability-record hashes.

This foundation does not yet expose the E1c CLI or an adapter that calculates E1 metrics from E1b
evidence. It has no Studio, external model, analytics, cloud, or automatic-correction integration.
