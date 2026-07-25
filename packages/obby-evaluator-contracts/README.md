# `@obby/obby-evaluator-contracts`

Evaluator-owned, bounded JSON Schema Draft 2020-12 contracts for Phase E1. The schema in
`schemas/evaluator-contracts.schema.json` is the structural source of truth. Generated TypeScript
under `src/generated/` and generated catalog/profile/hash fixtures under `fixtures/generated/`
must not be edited manually.

The package provides strict structural parsing, focused cross-field semantic checks, the six
result-source variants, evidence/runtime/availability foundations, and named SHA-256 preimage
helpers. Deterministic identities use `obby-canonical-json-v1`; execution IDs and execution
timestamps remain outside content identities where the Phase E0 contracts require that separation.

```text
npm run evaluator:contracts:generate
npm run evaluator:contracts:check
npm run evaluator:test
```

E1a does not calculate metrics, apply gates, generate reports, collect runtime observations, or
operate a CLI.
