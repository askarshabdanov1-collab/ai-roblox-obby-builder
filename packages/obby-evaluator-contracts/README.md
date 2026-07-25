# `@obby/obby-evaluator-contracts`

Evaluator-owned, bounded JSON Schema Draft 2020-12 contracts for Phase E1. The schema in
`schemas/evaluator-contracts.schema.json` is the structural source of truth. Generated TypeScript
under `src/generated/` and generated catalog/profile/hash fixtures under `fixtures/generated/`
must not be edited manually.

The package provides strict structural parsing, generated discriminated TypeScript unions,
cross-contract graph validation, verified evidence graphs, the six result-source variants, and
named SHA-256 preimage helpers. Evaluator identities use the separate
`obby-canonical-json-v1` API and hash one immutable snapshot exactly once; Phase 0 continues to use
the unchanged `@obby/canonical-json` 0.2.0 compatibility API.

The aggregate validator resolves MetricDefinition → MetricCatalog → ScoringProfile →
EvaluationPlan → EvaluationRequest, recomputes every supplied identity, resolves metric and
invariant references, detects derived-metric cycles, and accepts only exact semantic versions or
one/two strict comparator ranges. Evidence validation verifies content hashes before deterministic
parent traversal and enforces manifest and subject scope.

```text
npm run evaluator:contracts:generate
npm run evaluator:contracts:check
npm run evaluator:test
```

E1a does not calculate metrics, apply gates, generate reports, collect runtime observations, or
operate a CLI.
