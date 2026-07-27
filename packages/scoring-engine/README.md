# `@obby/scoring-engine`

Phase E1c deterministic evidence-to-report assembly.

The package applies result precedence in this order: catalog invariant failure, incomplete required
evidence, profile-specific failure, warning, then pass. Every invariant declared by the verified
MetricCatalog must be evaluated exactly once, and every category in the verified E1 ScoringProfile
must remain present with the same metric set. E1 reports always declare `aggregateScore: false`.

`finalizeE1Report` produces a content-addressed payload with no execution ID or timestamp.
`renderMarkdownReport` produces a separately hashed renderer artifact whose bytes never contain
their own render hash. `applyAvailabilityRecords` preserves the original report and creates a new
derived report linked to immutable availability-record hashes.

`assembleE1Evaluation` validates the complete plan/request/catalog/profile graph, validates the E1b
evidence DAG, calculates the ten E1 metrics, applies non-overridable catalog invariants, evaluates
completeness, and only then assembles profile categories. Calculations bind definition,
configuration, evidence, reproduction inputs, state, result/absence reason, limitations, and their
own content hash. The trust boundary is validated E1b evidence; calculators do not reread manifest
gameplay fields.

The reference profile has no weights and no aggregate score. `infeasible-under-model` remains a
profile-relative state, hazard/skip observations remain candidates, and optional runtime evidence
remains explicitly unavailable with an immutable availability record. No missing value is encoded
as a number or silently renormalized.

`renderMarkdownReport` emits deterministic identity, outcome, gate, completeness, calculation,
category, finding, evidence, deferred-capability, limitation, and reproduction sections. The render
hash binds payload hash, renderer/template version, configuration, and exact bytes; it excludes
paths and execution time.

Focused checks:

```text
npm run evaluator:scoring:test
npm run evaluator:scoring:check
npm run evaluator:report:test
```

This package has no Studio, external model, analytics, cloud, automatic-correction, or network
integration.
