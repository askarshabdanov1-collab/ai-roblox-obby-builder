# `@obby/scoring-engine`

Phase E1c deterministic evidence-to-report assembly.

The package applies result precedence in this order: catalog invariant failure, incomplete required
evidence, profile-specific failure, warning, then pass. Every invariant declared by the verified
MetricCatalog must be evaluated exactly once, and every category in the verified E1 ScoringProfile
must remain present with the same metric set. E1 reports always declare `aggregateScore: false`.

Report finalization is internal. The public `assembleE1Evaluation` boundary proves the complete
configuration, authoritative E1b evidence closure, calculation, finding, category, and identity
graph before producing a content-addressed payload with no execution ID or timestamp.
`renderMarkdownReport` accepts only verified payloads and produces LF-only, incrementally bounded,
separately hashed bytes that never contain their own render hash. `applyAvailabilityRecords`
preserves the original report and creates a new derived report linked to exact immutable
availability-record hashes.

`assembleE1Evaluation` validates the complete plan/request/catalog/profile graph, validates the E1b
evidence DAG, selects one route/object/transition/checkpoint/finish-correlated dependency closure,
calculates the ten E1 metrics, applies non-overridable catalog invariants, evaluates completeness
once, and only then assembles profile categories. Calculations bind definition,
configuration, evidence, reproduction inputs, state, result/absence reason, limitations, and their
own content hash. The trust boundary is validated E1b evidence; calculators do not reread manifest
gameplay fields.
Hazard and skip candidates enter that closure only when their deterministic E1b evidence ID agrees
with their validated object/relationship or route indexes; unrelated same-manifest candidates are
validated but remain byte-inert.
Missing route indexes are never interpolated into semantic IDs. Transition-parent and checkpoint
correlation use charged maps, making selection linear apart from deterministic `O(n log n)` sorting.
The selected transition and selected coarse-transition arrays each charge
`n * ceil(log2(max(n, 1)))` work units before their canonical hash-order sort.
Parent-evidence set comparison uses charged linear set construction and lookup rather than an
additional unaccounted sort.

`assembleE1Evaluation` is the only public creator of runtime-validated reports. The returned report
object is registered in a module-private weak identity map together with its assembly-time payload
hash. Rendering and availability derivation require that exact unchanged object (or a derived object
created by the same validated path); serialized reports, clones, structural lookalikes, TypeScript
casts, and caller-rehashed payloads remain untrusted and fail with `unvalidated-report`.

Catalog invariant dependencies explicitly name affected metrics/categories or declare global
scope. Generic runtime observations cannot satisfy checkpoint isolation; that optional metric stays
unavailable until a future exact multiplayer contract exists. Its E1c deferral record is bound to
the manifest-scoped capability, authority, producer, and policy identity, and competing effective
availability records fail closed.

The reference profile has no weights and no aggregate score. `infeasible-under-model` remains a
profile-relative state, hazard/skip observations remain candidates, and optional runtime evidence
remains explicitly unavailable with an immutable availability record. No missing value is encoded
as a number or silently renormalized. Warning/error metric results participate directly in the
executive outcome, so a warning cannot become a clean pass merely because no finding was emitted.

`renderMarkdownReport` emits deterministic identity, invariant/profile gates, completeness,
calculation, category blockers, finding, evidence, deferred-capability, limitation, and
reproduction sections. The render hash binds payload hash, renderer/template version,
configuration, and exact bytes; it excludes paths and execution time.
CRLF and lone CR content are normalized only for rendering, so emitted bytes never contain CR.

Focused checks:

```text
npm run evaluator:scoring:test
npm run evaluator:scoring:check
npm run evaluator:report:test
```

This package has no Studio, external model, analytics, cloud, automatic-correction, or network
integration.
