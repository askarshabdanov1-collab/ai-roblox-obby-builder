# Phase E1c implementation record

Phase E1c turns validated E1b evidence into deterministic metric calculations, invariant and
profile results, immutable report payloads, deterministic Markdown, and a staged local CLI. It
does not implement Studio/runtime collection, screenshots, ML, analytics, cloud/desktop services,
automatic repair, or orchestration.

## Architecture and trust boundary

The pipeline is strictly ordered:

1. validate MetricDefinitions, MetricCatalog, ScoringProfile, EvaluationPlan, and
   EvaluationRequest as one identity graph;
2. validate the E1b evidence DAG and resolve one authoritative dependency closure for the selected
   route;
3. calculate metrics only from records in that closure and verify each `calculationHash`;
4. apply every catalog invariant exactly once;
5. evaluate requested/required/optional completeness and availability explanations;
6. assemble profile categories and provisional thresholds;
7. create and hash the report payload;
8. render and separately hash Markdown.

Raw SceneManifest fields are not calculator inputs. The CLI validates the manifest and uses its
identity only to prove evidence scope. Gameplay facts come from content-addressed E1b evidence.

The evidence selector correlates the manifest, route, object, transition, checkpoint, finish,
subject, parent-hash, and evidence-kind identities before calculation. It requires unique semantic
coverage where a single record is authoritative. Unknown objects, wrong subjects or parents,
missing required checkpoint coverage, duplicate checkpoint coverage, and conflicting evidence for
the selected transition fail with deterministic typed errors. Valid evidence for another route or
non-required transition is ignored and is byte-inert. Hazard and skip candidates must also carry
the deterministic semantic evidence ID produced from their validated object/relationship or route
indexes; same-manifest records outside that namespace are ignored after their object, subject, and
parent bindings are validated. A conflicting alternative for the selected semantic subject is
rejected. Input order cannot choose the winner.
Route-relative semantic IDs are constructed only after membership yields a defined integer route
index. Missing indexes, including a caller-supplied literal `undefined` segment, are never
stringified into an authoritative ID. Route-external hazard records remain byte-inert.

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

Generic `runtime-observation` records never satisfy checkpoint-isolation. E1c has no exact
multiplayer checkpoint-isolation observation contract or collector, so the optional metric remains
`unavailable`. Its deferral can be explained only by the exact manifest-scoped runtime capability
availability identity; adding an arbitrary runtime record does not change calculations or report
bytes.

Catalog invariants cover required route topology, reference resolution, checkpoint ordering,
finish topology, gameplay-authoritative route geometry, evidence graph integrity, required metric
availability, and decorative gameplay collision. Profiles cannot remove or weaken them. A failed
invariant wins over profile/category output and blocks dependent calculation/category work with
the invariant ID and evidence hashes. Missing invariant evidence is incomplete, never pass.
Each catalog invariant declares content-addressed `affectedMetricIds`, `affectedCategoryIds`, and
either `declared` or `global` dependency scope. Declared failures affect only those dependencies;
only a catalog-declared global integrity gate propagates to every category. Unknown dependencies
and partial global mappings are rejected, and rendered category rows name their blocking gates.

## Completeness and categories

Completeness is computed once, after calculations, invariant resolution, and availability conflict
resolution. That one state drives the top-level completeness record, the
`policy.evidence-completeness` calculation (or its explicit unavailable/blocked state), the
required-metric gate, executive outcome, and renderer. It checks exact requested metric IDs, unique
calculations, current hashes, definition and configuration binding, required evidence, parent
calculations, evidence/finding references, and availability explanations. Unknown, duplicate,
conflicting, stale, or unresolved inputs fail closed. Required unavailable or indeterminate
metrics are incomplete; conditional not-applicable and a correctly explained optional runtime
deferral are the only accepted absence cases in the E1 profile.

Runtime availability is keyed by capability ID/version, manifest-derived stable subject ID,
subject kind and content hash, authority, producer, policy version, effective sequence/time domain,
state, reason, impact scope, and `availabilityRecordHash`. Equivalent records deduplicate and their
input order is inert. Supersession must produce one unambiguous effective leaf; competing leaves,
producer changes without an explicit resolution policy, or an unresolvable authority state fail
closed without overwriting history. Availability-derived report items use the full
subject/capability/record identity, so different subjects cannot collide.

Category membership is copied from the selected verified profile after gates and completeness.
Optional missing metrics are shown explicitly and are never numerically renormalized. Profile
failure (`fail-under-profile`), invariant failure (`fail`), warning, and incomplete are distinct.
The E1 profile has no weights and `aggregateScore` is always `false`.
Executive warning state is derived from authoritative warning/error metric results as well as
validated findings. A warning metric therefore cannot yield a clean pass, while a matching finding
does not inflate it and candidate evidence is still not promoted to a confirmed failure.

## Report and Markdown identity

The report payload contains request/configuration/manifest/catalog/profile/calculation-bundle
identities, calculations, gates, completeness, categories, findings, evidence index, availability
records, missing/deferred capabilities, comparability, and limitations. It excludes execution IDs,
wall-clock time, paths, export format, transport, and CLI invocation metadata.

Report finalization is an internal assembly step. The package public API exposes
`assembleE1Evaluation`, which validates the full configuration/evidence/calculation graph before
finalization; callers cannot publish a trusted-looking report through a raw public finalizer.
The finalizer is a non-exported local function in the assembly module; neither built `report.js`
nor its declaration contains a raw finalization export.
Availability overlays create a newly hashed derived report and preserve the original payload.

Markdown deterministically renders identity, executive state, invariant gates, completeness,
calculations, categories/profile results, findings, evidence, deferred capabilities, limitations,
and reproduction data. Unicode-scalar ordering is used; locale time/number formatting and current
timestamps are absent. `reportRenderHash` is separate from `reportPayloadHash` and binds renderer,
template, configuration, format, and exact rendered bytes. Rendering never accepts an identity
verification bypass, includes profile-gate and category blocker rows, and emits LF-only bytes on
every platform. Output bytes are incrementally bounded before the complete Markdown buffer is
allocated. Renderer work is deterministically precharged: the exact output-line count is charged
first, followed by a separate pre-sort charge for every ordered renderer collection. A collection
of size `n` costs `n * ceil(log2(max(n, 1)))` sort units, so zero- and one-item sorts cost zero.
All additions and multiplications are safe-integer checked. If a charge would exceed the budget,
the corresponding sort is not invoked and neither Markdown bytes nor a render identity is returned.
Successful results expose `workUnitsUsed`; that operational counter is excluded from the render
identity preimage. Reproduction entries reuse the already charged canonical calculation ordering;
they do not perform or claim a second sort.
Renderer-only normalization converts CRLF and lone CR content to LF and then flattens embedded line
breaks inside one Markdown line. It does not mutate or redefine semantic report payload identity.

## CLI and atomic output

Run the local CLI with all inputs explicitly named:

```text
npm run evaluator -- evaluate --request <request.json> --plan <plan.json> --definitions <definitions.json> --catalog <catalog.json> --profile <profile.json> --manifest <scene-manifest.json> --evidence <evidence-bundle.json> --availability <availability-records.json> --output <relative-directory>
```

Add `--json-errors` for a stable `{ok:false,error:{code,message}}` response. Usage errors distinguish
unknown, duplicate, missing-value, and missing-required options. Input errors distinguish missing
or unreadable files, non-files, byte limits, malformed JSON, schema failures, and semantic/hash
validation. Publication, path-change, destination-conflict, cleanup, and output-limit failures also
have stable codes. Known filesystem failures (`ENOENT`, `ENOTDIR`, `EISDIR`, permission denial,
existing entries, overlong paths, and reparse loops) map to platform-neutral codes. Messages use
logical labels, omit absolute host paths and native OS text, and do not emit stack traces. There is
no network access.

Output is a semantic directory named from the full `reportPayloadHash`. Each invocation uses a
unique temporary sibling directory. The CLI writes `report.json` and `report.md`, fsyncs every
file, attempts to fsync the temporary directory, renames only the complete directory, and attempts
to fsync the final parent. Existing byte-identical output is a no-op and concurrent identical
publishers converge; different existing content is never overwritten. Pre-commit failure removes
the temporary directory. A failure after rename may report unsuccessful durability while leaving
the complete two-file set visible. Process or host crashes may leave uniquely named temporary
directories for later manual cleanup; E1c has no startup reconciliation service.

Output is relative, NFC-normalized, path-length bounded, rejects parent traversal, reserved Windows
device segments, trailing dot/space segments, symlink/junction/reparse segments, and input/output
collisions. Directory realpath/device/inode/birth identity is captured and rechecked immediately
before and after rename, failing closed if an ancestor changes. Windows collision comparison is
case-insensitive. Portable Node does not provide descriptor-relative rename on every target, so a
small replacement window remains between the final identity check and path-based operation; E1c
does not claim absolute race freedom against a privileged concurrent filesystem attacker.
An existing semantic output is convergent only after the final path and every captured ancestor are
verified as ordinary directories under the validated root. Identity is checked before reading
report bytes and again after reading; byte equality never authorizes a symlink, junction, reparse
point, or replaced directory.

## Deterministic limits

- 256 MetricDefinitions and calculations;
- 4,096 findings, evidence records, and availability records;
- 16,384 report items;
- 100,000 scoring work units;
- 8 MiB per CLI input file;
- 16 MiB total semantic output;
- 240-character resolved output path.

Limits are checked before the corresponding expensive or publishing operation. Work units charge
input/configuration validation, evidence selection and correlation, metric dispatch and hashing,
availability resolution, category/gate assembly, and report construction. Counters reject unsafe
integer growth. Renderer line work is precharged exactly, renderer sort work is charged immediately
before each sort, and output bytes are incrementally bounded. Dominant selection and validation
passes are linear in bounded records with map/set indexes; canonical sorting and hashing are
`O(n log n)` in their bounded collections. Input data is parsed as JSON only and is never executed.
Transition parent hashes and checkpoint IDs are indexed once. Each insertion, duplicate/conflict
check, and correlation lookup consumes work units; route correlation contains no repeated full-array
`find` or `filter` scan, so its worst case is `O(n log n)` including deterministic sorting and
`O(n)` excluding sorting. Selected route transitions and selected coarse-transition states are
charged separately before sorting, using `n * ceil(log2(max(n, 1)))` for each collection. Work-budget
overflow is rejected before either sort executes.
Parent-evidence equality uses charged linear set construction and membership lookup, including the
potentially large route-summary parent closure, instead of an additional canonical sort.

## Runtime report trust boundary

The serializable report payload is not itself proof that full E1 assembly ran. The public
`assembleE1Evaluation` facade registers its report object in a module-private weak identity map and
binds that object to its assembly-time `reportPayloadHash`. Public Markdown rendering and availability
derivation require the same unchanged registered object. The marker is not serialized or exported;
plain objects, deserialized reports, clones, structural TypeScript casts, and caller-rehashed reports
fail deterministically with `unvalidated-report`. Availability-derived reports are newly hashed and
registered by the same private boundary without mutating the source report.

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
- [x] Staged no-network CLI with typed errors, durability attempts, and bounded paths/input/output/work.
- [x] Generated positive/negative end-to-end fixtures and non-mutating drift check.
- [x] Ubuntu/Windows CI use the root `npm run validate` gate.
- [x] Repository-only Studio feasibility guard model and human-only probe procedure added; no Studio
      execution or runtime evidence collection is claimed.
- [ ] Studio/runtime checkpoint isolation collection remains a later human feasibility and runtime
      evidence milestone.
