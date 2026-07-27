# Phase E1c implementation record

Phase E1c turns validated E1b evidence into deterministic metric calculations, invariant and
profile results, immutable report payloads, deterministic Markdown, and an atomic local CLI. It
does not implement Studio/runtime collection, screenshots, ML, analytics, cloud/desktop services,
automatic repair, or orchestration.

## Architecture and trust boundary

The pipeline is strictly ordered:

1. validate MetricDefinitions, MetricCatalog, ScoringProfile, EvaluationPlan, and
   EvaluationRequest as one identity graph;
2. validate the E1b evidence DAG and manifest scope;
3. calculate evidence-bound metrics and verify each `calculationHash`;
4. apply every catalog invariant exactly once;
5. evaluate requested/required/optional completeness and availability explanations;
6. assemble profile categories and provisional thresholds;
7. create and hash the report payload;
8. render and separately hash Markdown.

Raw SceneManifest fields are not calculator inputs. The CLI validates the manifest and uses its
identity only to prove evidence scope. Gameplay facts come from content-addressed E1b evidence.

## Metrics, states, and gates

The implemented metric families cover required-route continuity, required transition
model-relative feasibility, checkpoint topology, finish topology, hazard candidates, skip
candidates, evidence completeness, decorative collision policy, native-Part count, and deferred
runtime checkpoint-isolation availability.

Calculations use `calculated`, `unavailable`, `not-applicable`, `blocked-by-invariant`, or
`indeterminate`. Absence is never represented by a numeric sentinel. Coarse states retain
`feasible-under-model`, `infeasible-under-model`, and `indeterminate`; they never claim universal
impossibility. Hazard and skip counts remain candidates and can produce warnings, not confirmed
failures.

Catalog invariants cover required route topology, reference resolution, checkpoint ordering,
finish topology, gameplay-authoritative route geometry, evidence graph integrity, required metric
availability, and decorative gameplay collision. Profiles cannot remove or weaken them. A failed
invariant wins over profile/category output and blocks dependent calculation/category work with
the invariant ID and evidence hashes. Missing invariant evidence is incomplete, never pass.

## Completeness and categories

Completeness checks exact requested metric IDs, unique calculations, current hashes, definition and
configuration binding, required evidence, parent calculations, evidence/finding references, and
availability explanations. Unknown, duplicate, conflicting, stale, or unresolved inputs fail
closed. Optional runtime absence is reported without inventing a value; an unexplained absence
makes completeness incomplete.

Category membership is copied from the selected verified profile after gates and completeness.
Optional missing metrics are shown explicitly and are never numerically renormalized. Profile
failure (`fail-under-profile`), invariant failure (`fail`), warning, and incomplete are distinct.
The E1 profile has no weights and `aggregateScore` is always `false`.

## Report and Markdown identity

The report payload contains request/configuration/manifest/catalog/profile/calculation-bundle
identities, calculations, gates, completeness, categories, findings, evidence index, availability
records, missing/deferred capabilities, comparability, and limitations. It excludes execution IDs,
wall-clock time, paths, export format, transport, and CLI invocation metadata.

Markdown deterministically renders identity, executive state, invariant gates, completeness,
calculations, categories/profile results, findings, evidence, deferred capabilities, limitations,
and reproduction data. Unicode-scalar ordering is used; locale time/number formatting and current
timestamps are absent. `reportRenderHash` is separate from `reportPayloadHash` and binds renderer,
template, configuration, format, and exact rendered bytes.

## CLI and atomic output

Run the local CLI with all inputs explicitly named:

```text
npm run evaluator -- evaluate --request <request.json> --plan <plan.json> --definitions <definitions.json> --catalog <catalog.json> --profile <profile.json> --manifest <scene-manifest.json> --evidence <evidence-bundle.json> --availability <availability-records.json> --output <relative-directory>
```

Add `--json-errors` for a stable `{ok:false,error:{code,message}}` response. Failures return a
nonzero code and omit stack traces. There is no network access.

Output is a semantic directory named from `reportPayloadHash`. The CLI writes `report.json` and
`report.md` with exclusive temporary files inside a temporary sibling directory, fsyncs each file,
and renames the directory only after all work succeeds. Failures remove the temporary directory.
Existing byte-identical output is a no-op; different existing content is never overwritten. Output
must be relative to the working directory, cannot traverse parents or existing symlinks, and is
path-length bounded.

## Deterministic limits

- 256 MetricDefinitions and calculations;
- 4,096 findings, evidence records, and availability records;
- 16,384 report items;
- 100,000 scoring work units;
- 8 MiB per CLI input file;
- 16 MiB total semantic output;
- 240-character resolved output path.

Limits are checked before the corresponding expensive or publishing operation. Input data is parsed
as JSON only and is never executed.

## Fixtures and validation

Committed fixtures cover passing structural topology, model-relative failure, indeterminate route,
invariant failure, hazard plus skip candidates, missing runtime evidence, stale calculation hash,
unresolved evidence, duplicate calculation, and conflicting calculation. Positive fixtures contain
real hashes and no zero placeholder. `npm run evaluator:fixtures:check` regenerates expected bytes
in memory and fails on drift.

Focused commands:

```text
npm run evaluator:scoring:test
npm run evaluator:scoring:check
npm run evaluator:report:test
npm run evaluator:cli:test
npm run evaluator:fixtures:generate
npm run evaluator:fixtures:check
npm run evaluator:smoke
```

## Acceptance checklist

- [x] Evidence-bound deterministic metric calculations and hashes.
- [x] Non-overridable invariant precedence and evidence links.
- [x] Explicit completeness, optional availability, and fail-closed stale/conflicting inputs.
- [x] Profile-owned categories with no hidden weight, normalization, or aggregate score.
- [x] Immutable deterministic report payload and full deterministic Markdown.
- [x] Atomic no-network CLI with typed errors and bounded paths/input/output/work.
- [x] Generated positive/negative end-to-end fixtures and non-mutating drift check.
- [x] Ubuntu/Windows CI use the root `npm run validate` gate.
- [ ] Studio/runtime checkpoint isolation collection remains a later feasibility milestone.
