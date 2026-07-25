# Evaluation contract design

## Contract policy

Evaluator contracts will be JSON Schema Draft 2020-12 with generated TypeScript types, following the
Phase 0 structural/semantic split. E0 does not add schema files; the structures below are design
definitions for E1 review.

Each contract has:

- a contract-specific `schemaVersion`, initially proposed as `0.1`;
- `additionalProperties: false` except explicitly versioned extension maps;
- bounded strings, arrays, numbers, timestamps, and artifact sizes;
- canonical JSON hashing for immutable records;
- UTC RFC 3339 wall-clock timestamps plus monotonic offsets for runtime sequences;
- namespaced stable IDs;
- explicit source classification: `deterministic`, `heuristic`, `learned`, `analytics-derived`,
  `subjective`, or `derived`;
- no credentials, local absolute paths, usernames, or private identifiers in persisted records.

Evaluation contracts reference a SceneManifest by immutable hash. They do not copy or modify Phase 0
PlaceSpec/SceneManifest structure.

## Shared primitives

| Type               | Fields and constraints                                                                |
| ------------------ | ------------------------------------------------------------------------------------- |
| `ContentHash`      | `sha256:` followed by 64 lowercase hexadecimal characters                             |
| `EvaluatorVersion` | Semantic version plus optional build hash                                             |
| `ExecutionId`      | UUIDv7 or another sortable opaque ID; unique per attempt                              |
| `EvidenceId`       | Stable kind/subject ID plus evidence content hash                                     |
| `MetricId`         | Namespaced kebab ID such as `playability.route-completeness`                          |
| `ObjectRef`        | `objectId`, optional `role`, manifest hash                                            |
| `TransitionRef`    | `fromObjectId`, `toObjectId`, global route indices                                    |
| `Point3`           | Finite bounded `x`, `y`, `z` in studs                                                 |
| `ImageRegion`      | Normalized `[0,1]` `x`, `y`, `width`, `height`, screenshot evidence ID                |
| `Confidence`       | `value` in `[0,1]`, `basis`, `limitations[]`, `sampleCount?`                          |
| `SourceKind`       | `deterministic`, `heuristic`, `learned`, `analytics-derived`, `subjective`, `derived` |
| `Severity`         | `info`, `warning`, `error`, `blocking`                                                |
| `ArtifactRef`      | content hash, media type, byte length, store key, retention class                     |
| `VersionRef`       | component name, semantic version, build/config hash                                   |

## Discriminated metric-result contracts

`EvaluationMetric` is a tagged union. A result has exactly one variant and cannot use mixed labels:

| Variant                      | Required fields and confidence semantics                                                                                                      | Evidence and limitations                                                                                     | Blocking participation                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `deterministic-fact`         | `sourceKind: deterministic`, exact typed value/unit, method/version; confidence is `1` only when all required inputs and operations are exact | Deterministic evidence IDs; limitations identify modeled omissions but cannot turn the fact into an estimate | May trigger an invariant only when the MetricDefinition explicitly names that invariant         |
| `heuristic-estimate`         | `sourceKind: heuristic`, typed value/unit, confidence calculation ID and inputs                                                               | Evidence IDs, uncertainty/coverage, non-empty limitations                                                    | May trigger only a model-relative profile gate; never a universal impossibility invariant       |
| `learned-estimate`           | `sourceKind: learned`, typed value/unit, model/config/input hashes, calibrated confidence                                                     | Evidence IDs, domain/coverage status, non-empty limitations                                                  | Never independently invariant-blocking                                                          |
| `analytics-derived-estimate` | `sourceKind: analytics-derived`, typed value/unit, calibration snapshot, sample/uncertainty fields                                            | Aggregate evidence IDs, cohort/experiment limitations                                                        | Never independently invariant-blocking or automatically generation-controlling                  |
| `human-judgment`             | `sourceKind: subjective`, label distribution rather than a promoted scalar fact, instructions/study versions                                  | Label evidence IDs, rater effects, agreement, ties/uncertain, limitations                                    | Never independently invariant-blocking                                                          |
| `derived-composite`          | `sourceKind: derived`, typed value/unit, fusion/calculation definition hash, ordered `parentMetricIds[]`                                      | Parent metric and derived evidence IDs, propagation rule, non-empty limitations                              | Cannot be more authoritative than its parents and never inherits invariant authority implicitly |

Each source produces a separate component metric. Fusion produces only a `derived-composite`;
reports preserve component values and source classes. Human judgments remain subjective, learned
outputs remain estimates, and deterministic findings remain facts.

## Metric catalog and scoring-profile contracts

These behavior-bearing configurations are content-addressed:

### `MetricDefinition`

- stable `metricId` and semantic `metricVersion`;
- exactly one result variant;
- value schema/unit/range and applicability;
- required evidence kinds/capabilities and zero-observation behavior;
- calculation method/configuration and confidence method;
- invariant ID, profile threshold definitions, and advisory thresholds kept separate;
- normalization rule, limitations template, and comparison compatibility class;
- `metricDefinitionHash` over the canonical definition.

### `MetricCatalog`

- ordered MetricDefinitions with unique IDs/versions;
- invariant registry and non-overridable behavior;
- catalog semantic version plus `metricCatalogHash`;
- supported evaluator/contract ranges;
- no mutable “latest” definition inside a finalized execution.

### `ScoringProfile`

- profile ID/version plus `scoringProfileHash`;
- required/optional metric IDs, category/display configuration, evidence completeness rules;
- profile-selectable acceptance and advisory thresholds;
- optional experimental aggregation configuration;
- explicit compatibility class.

A ScoringProfile may change display severity for an invariant finding, but cannot change its
`blocking: true`, invariant ID, outcome effect, or evidence requirements. Profiles cannot exclude,
weaken, waive, or downgrade registered invariants.

## `EvaluationPlan`

An immutable request describing what evidence and scores are required.

| Field                             | Design                                                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                   | Evaluator plan contract version                                                                                                         |
| `planId`                          | Stable caller-provided kebab ID                                                                                                         |
| `scene`                           | `manifestHash`, `schemaVersion`, optional content-addressed manifest artifact                                                           |
| `profile`                         | scoring profile ID, version, content hash, and compatibility class                                                                      |
| `catalog`                         | metric catalog ID, version, and content hash                                                                                            |
| `requiredCapabilities`            | Subset of `geometry`, `route`, `coarse-jump`, `runtime-controller-trials`, `runtime`, `screenshots`, `visual`, `reference`, `analytics` |
| `views`                           | Ordered `ScreenshotView` specifications or protocol IDs                                                                                 |
| `avatarProfiles`                  | Ordered rig/controller/movement parameter references                                                                                    |
| `deviceProfiles`                  | Ordered viewport/performance classes                                                                                                    |
| `metricInclude` / `metricExclude` | Bounded stable metric IDs; unknown IDs fail                                                                                             |
| `budgets`                         | Per-stage timeout, total timeout, memory, evidence bytes, screenshot count                                                              |
| `partialEvidencePolicy`           | `reject`, `finalize-with-missing`, or capability-specific map                                                                           |
| `comparisonGroupId?`              | Shared group for variant comparison                                                                                                     |
| `seed`                            | Integer used only by explicitly seeded evaluator operations                                                                             |
| `createdAt`                       | Informational; excluded from deterministic configuration hash                                                                           |
| `configurationHash`               | Canonical hash of all behavior-affecting fields                                                                                         |

Semantic rules include: required metrics must have required capabilities; runtime controller trials
require a compatible Studio capability; visual requires screenshots; reference and analytics
require approved immutable snapshot hashes; exclusions cannot remove invariant metrics.

## `EvaluationRun`

The lifecycle and execution-specific identity of one attempt.

| Field                                                         | Design                                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`, `executionId`, `planId`                      | Execution identity; `executionId` is random/unique                                                                                                     |
| `manifestHash`, `planHash`, `configurationHash`               | Pinned inputs                                                                                                                                          |
| `evaluatorVersion`, `metricCatalogHash`, `scoringProfileHash` | Reproduction identities                                                                                                                                |
| `status`                                                      | `queued`, `validating`, `analyzing`, `collecting-runtime`, `capturing`, `analyzing-visuals`, `scoring`, `finalized`, `rejected`, `cancelled`, `failed` |
| `stageStates[]`                                               | Stage ID, attempt, status, timestamps, timeout, error code                                                                                             |
| `startedAt`, `finishedAt?`                                    | Execution-specific UTC timestamps                                                                                                                      |
| `supersedesExecutionId?`                                      | New execution created as retry/re-evaluation                                                                                                           |
| `capabilityResults[]`                                         | Capability, `complete`/`partial`/`missing`/`failed`, evidence IDs                                                                                      |
| `environment`                                                 | OS/architecture and applicable Studio/engine/renderer/GPU/driver/locale/colorspace settings                                                            |
| `calculationBundleHash?`, `reportPayloadHash?`                | Deterministic outputs when finalized                                                                                                                   |
| `failure?`                                                    | Stable code, safe message, stage, retryability; no stack trace secrets                                                                                 |
| `executionEnvelopeHash`                                       | Hash of the complete execution envelope, including execution ID/timestamps                                                                             |

Terminal runs are immutable. Progress messages are transient and are not part of the finalized
contract.

## `EvaluationEvidence`

An envelope for one reproducible evidence item.

| Field                               | Design                                                                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `evidenceId`       | Content identity                                                                                                                                                              |
| `executionId?`                      | Optional provenance; excluded from deterministic evidence content when the payload is execution-independent                                                                   |
| `kind`                              | `geometry-fact`, `route-transition`, `runtime-observation`, `screenshot`, `image-feature`, `performance-sample`, `reference-comparison`, `analytics-aggregate`, `human-label` |
| `sourceKind`                        | One of the six source classifications                                                                                                                                         |
| `manifestHash`, `generationToken?`  | Scene binding                                                                                                                                                                 |
| `subject`                           | Object refs, transition refs, coordinates, image regions, or whole-scene scope                                                                                                |
| `producer`                          | Component/model/collector version and configuration hash                                                                                                                      |
| `capturedAt?`, `monotonicOffsetMs?` | Runtime ordering where relevant                                                                                                                                               |
| `payload`                           | Discriminated union keyed by `kind`; generic unvalidated maps are prohibited                                                                                                  |
| `artifactRefs[]`                    | Content-addressed screenshots/log chunks/etc.                                                                                                                                 |
| `parentEvidenceIds[]`               | Inputs used to derive this evidence                                                                                                                                           |
| `quality`                           | Completeness, validity checks, confidence where non-deterministic                                                                                                             |
| `limitations[]`                     | Required for non-deterministic evidence                                                                                                                                       |
| `evidenceContentHash`               | Canonical hash over kind, scene/subject, producer/config, payload, ordered parents/artifacts, quality, and limitations                                                        |

Evidence derivation must be acyclic. Every parent must belong to the same manifest/execution or be an
explicitly versioned approved reference/calibration snapshot.

## `EvaluationMetric`

A metric result is one of the six discriminated variants above and shares:

| Field                                                                | Design                                                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `metricId`, `metricVersion`, `metricDefinitionHash` | Identity                                                                                                                               |
| `category`                                                           | Playability, readability, checkpoint, hazard, composition, style, performance, difficulty, onboarding, retention-readiness, confidence |
| `resultKind`, `sourceKind`                                           | Contract-enforced variant tags                                                                                                         |
| `status`                                                             | `available`, `not-applicable`, `missing-evidence`, `failed`                                                                            |
| `rawValue`, `unit`                                                   | Variant-defined typed value and stable unit                                                                                            |
| `normalizedScore?`                                                   | `[0,100]`; absent for unscored facts and unavailable results                                                                           |
| `confidence`                                                         | Variant-specific semantics; no unexplained constant                                                                                    |
| `severity`, `blocking`, `invariantId?`                               | Invariant status resolved before profile display severity                                                                              |
| `evidenceIds[]`                                                      | Non-empty for available results                                                                                                        |
| `parentMetricIds[]?`                                                 | Required only for a derived composite                                                                                                  |
| `thresholdsApplied`                                                  | Invariant plus profile acceptance/advisory thresholds, each classified                                                                 |
| `limitations[]`                                                      | Required for every non-deterministic or derived result                                                                                 |
| `calculationHash`                                                    | Deterministic hash of definition, parameters, ordered evidence/parents, and result                                                     |

Ratio MetricDefinitions declare `zeroObservationBehavior` as one of `not-applicable`,
`missing-evidence`, or a domain-justified exact value. No ratio defaults to pass when its denominator
is zero; checkpoint isolation with zero observed checkpoint/respawn opportunities is
`missing-evidence`.

## `EvaluationFinding`

An actionable, evidence-backed observation.

| Field                                  | Design                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `findingId`           | Deterministic finding identity                                                                                      |
| `executionId?`                         | Optional execution provenance; excluded from deterministic finding calculation identity                             |
| `ruleId`, `ruleVersion`, `metricIds[]` | Source rules                                                                                                        |
| `title`, `summary`                     | Safe bounded text generated from templates where deterministic                                                      |
| `severity`, `blocking`, `invariantId?` | Invariant blocking is catalog-resolved; profile may alter display severity only                                     |
| `sourceKind`                           | Inherited from rule/metric                                                                                          |
| `subjects`                             | Object IDs, transitions, coordinates, views, image regions                                                          |
| `evidenceIds[]`                        | Required                                                                                                            |
| `reproduction`                         | Analyzer inputs or Studio steps without machine-specific paths                                                      |
| `suggestedCorrection?`                 | Advisory typed intent, affected object IDs, predicted tradeoffs                                                     |
| `limitations[]`                        | Why the finding may be incomplete                                                                                   |
| `disposition?`                         | Future human review state; a display/workflow waiver never changes an invariant's blocking status or outcome effect |

Suggested corrections do not contain executable scripts and cannot be automatically applied.

## `EvaluationReport`

The finalized deterministic payload that ties the calculation together. Execution timing/status
remains in EvaluationRun.

| Field                                | Design                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `schemaVersion`, `reportPayloadHash` | Deterministic payload identity                                                                |
| `calculationBundleHash`              | Ordered behavior-bearing input/evidence/calculation identity                                  |
| `scene`, `plan`, `versions`          | Manifest/plan/config/evaluator/catalog/profile content hashes                                 |
| `outcome`                            | `pass`, `pass-with-warnings`, `fail-under-profile`, `fail`, `incomplete`                      |
| `blockingFindingIds[]`               | Deterministic list                                                                            |
| `scoreProfile`                       | Category results, confidence, and classified optional experimental aggregation when permitted |
| `metrics[]`                          | Ordered embedded metric results or references                                                 |
| `findings[]`                         | Ordered finding references                                                                    |
| `evidenceIndex[]`                    | Evidence ID, kind, hash, artifact refs                                                        |
| `missingEvidence[]`                  | Capability/metric, reason, consequence                                                        |
| `comparability`                      | Comparison group/profile and compatible dimensions                                            |
| `limitations[]`                      | Report-wide limitations and prohibited interpretations                                        |

Ordering is canonical: category, metric ID, finding severity/rule/subject, evidence ID.
`generatedAt`, execution ID, local paths, and renderer metadata are excluded from this payload.
A rendered Markdown/HTML report is a separate artifact with `reportRenderHash`, renderer
version/configuration, report payload hash, locale, and render timestamp.

## `ScreenshotView`

The requested and observed deterministic capture definition.

| Field                                        | Design                                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `viewId`, `protocolVersion` | Identity                                                                                                                                                                      |
| `kind`                                       | `spawn`, `first-route`, `checkpoint-approach`, `checkpoint-respawn`, `hazard-approach`, `finish-approach`, `top-down`, `three-quarter-overview`, `mobile`, `failure-specific` |
| `anchor`                                     | Object ID/transition/finding and local or world-space transform rule                                                                                                          |
| `camera`                                     | Position/orientation or look-at target, FOV, projection assumptions                                                                                                           |
| `viewport`                                   | Width, height, scale, safe-area/device profile                                                                                                                                |
| `render`                                     | Graphics quality, lighting profile, time of day, post-processing policy                                                                                                       |
| `visibility`                                 | UI, character, nameplates, debug overlays                                                                                                                                     |
| `timing`                                     | Settle frames/ms, capture offset, animation policy                                                                                                                            |
| `expectedManifestHash`                       | Stale-scene guard                                                                                                                                                             |
| `observed`                                   | Actual camera/render/viewport/engine plus OS/scaling, renderer/API, GPU/driver, locale, DPI/device-pixel ratio, and colorspace                                                |
| `artifact`                                   | Image `ArtifactRef`                                                                                                                                                           |

## `RuntimeObservation`

One ordered Studio fact or measurement.

| Field                                                        | Design                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `observationId`, `executionId`, `sessionId` | Identity                                                                                                                                                                                                         |
| `manifestHash`, `generationToken`, `playerSlot?`             | Scope                                                                                                                                                                                                            |
| `sequence`, `monotonicOffsetMs`, `observedAt`                | Ordering                                                                                                                                                                                                         |
| `kind`                                                       | `scene-loaded`, `character-spawned`, `checkpoint-activated`, `character-died`, `character-respawned`, `finish-touched`, `softlock-candidate`, `transition-attempt`, `frame-sample`, `log-event`, `capture-ready` |
| `subject`                                                    | Object/transition/player-slot refs and position/orientation                                                                                                                                                      |
| `payload`                                                    | Kind-discriminated bounded payload; generic maps are prohibited                                                                                                                                                  |
| `collectorVersion`, `engineVersion`                          | Reproduction                                                                                                                                                                                                     |
| `validity`                                                   | Required scene/generation/session checks                                                                                                                                                                         |

Player slots are evaluator-local pseudonyms, never Roblox usernames or user IDs.

Runtime payload variants define their required fields:

- scene/capture readiness: ownership, manifest/generation, readiness checks;
- character spawn/respawn/death: player slot, character generation, root transform, cause/source;
- checkpoint/finish: player slot, object ID, activation order/result;
- transition attempt: transition ID, controller/avatar profile, start/end transforms, result,
  duration, attempt policy;
- frame sample: sample interval, frame/physics/memory counters and device/render environment;
- log event: allowlisted event code, structured fields, severity and source component;
- softlock candidate: region/route subjects, recovery actions attempted, timeout policy.

Unknown kinds or missing kind-specific fields fail validation. Runtime controller trials emit
empirical results for their recorded profile; they never emit a universal `exact` verdict.

## `ReferenceProfile`

A non-executable metadata/feature record for one curated reference item.

| Field                                        | Design                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `schemaVersion`, `referenceId`, `snapshotId` | Identity                                                                 |
| `provenance`                                 | Source URL, capture date, collector, acquisition method                  |
| `rights`                                     | License/terms status, permitted uses, review date, restrictions          |
| `experience`                                 | Public experience ID/URL when permitted, genre tags, declared style tags |
| `publicIndicators`                           | Named indicator, observed value/date/source; explicitly non-quality      |
| `screenshot`                                 | View type, capture conditions, artifact hash, crop/transform history     |
| `annotations`                                | Quality level, annotator protocol, route/style/composition tags          |
| `features`                                   | Versioned derived palette/saliency/embedding summaries                   |
| `duplicateGroupId?`, `split`                 | Deduplication and train/validation/test isolation                        |
| `status`                                     | `active`, `restricted`, `withdrawn`, `deleted`                           |

No map geometry, asset package, branding extraction, character replica, or private analytics belong
in this contract.

## `HumanPreferenceLabel`

A consented pairwise judgment.

| Field                                | Design                                                              |
| ------------------------------------ | ------------------------------------------------------------------- |
| `schemaVersion`, `labelId`, `taskId` | Identity                                                            |
| `questionId`, `instructionsVersion`  | Stable prompt/protocol                                              |
| `leftItem`, `rightItem`              | Randomized artifact/evaluation refs; presentation order retained    |
| `choice`                             | `left`, `right`, `tie`, `uncertain`, `skip`                         |
| `reasonCodes[]`, `comment?`          | Bounded taxonomy and optional moderated text                        |
| `raterPseudonym`                     | Study-scoped pseudonym                                              |
| `raterCohort`                        | Approved aggregate descriptors only                                 |
| `qualityControl`                     | Attention-check type/result, duration bounds, duplicate consistency |
| `createdAt`                          | UTC timestamp                                                       |
| `consentVersion`, `retentionClass`   | Governance                                                          |

Raw labels remain subjective. Aggregates record sample count, agreement, uncertainty, cohort mix,
and exclusion rules.

## Compatibility and migrations

- Readers support only declared version ranges and fail closed on newer major/minor structures.
- Additive optional fields may use a minor version only when semantics are unchanged.
- Changed calculation semantics require a new metric version and usually a new catalog/profile
  version.
- Finalized reports are never rewritten in place; migration creates a derived artifact with parent
  hash and migration version.
- An evaluator execution pins all contract versions. Mixed-version evidence is rejected unless an
  explicit, tested adapter is listed in the plan.

## Hash and reproducibility domains

All hashes use repository canonical JSON and SHA-256. Arrays with semantic order preserve it; sets
and maps are normalized by their contract-defined stable ordering.

| Identity                | Included fields                                                                                                                                                                             | Excluded fields                                                                                       | Timestamp/random ID policy                                                                     | Equivalent-run guarantee                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `executionId`           | None; opaque UUIDv7 identity                                                                                                                                                                | All content                                                                                           | Random and unique                                                                              | Intentionally different                                      |
| `executionEnvelopeHash` | Complete EvaluationRun including execution ID, stage attempts/status, timestamps, environment and output hashes                                                                             | Transient progress messages and local diagnostic stacks                                               | Includes execution ID/timestamps                                                               | Not byte-identical across executions                         |
| `calculationBundleHash` | Manifest, plan configuration, evaluator, MetricCatalog/ScoringProfile content hashes, compatible environment class, ordered deterministic/approved evidence content hashes and calculations | Execution ID, wall-clock timestamps, local paths, retry counters, renderer-only fields                | Excludes random IDs/timestamps                                                                 | Must be byte-identical for equivalent calculation inputs     |
| `evidenceContentHash`   | Kind, manifest/subject, producer/configuration, typed payload, ordered parent/artifact hashes, quality and limitations                                                                      | Execution ID when execution-independent, storage key, capture wall clock unless semantically required | Runtime capture/sequence fields remain when they are evidence; arbitrary storage time does not | Identical only for semantically identical evidence           |
| `reportPayloadHash`     | Canonical deterministic EvaluationReport payload and calculation bundle hash                                                                                                                | Execution ID, generated timestamp, local paths, render metadata                                       | Excludes random IDs/timestamps                                                                 | Must be byte-identical for equivalent calculation inputs     |
| `reportRenderHash`      | Report payload hash, renderer/version/configuration, locale, rendered bytes                                                                                                                 | Local output path                                                                                     | Render timestamp is metadata outside the rendered-byte hash                                    | Identical only for the same payload and renderer environment |

Semantic equivalence requires the exact contract, evaluator, definition/catalog/profile hashes and
compatible environment class. Merely reusing a version string is insufficient.

## Evidence availability and immutable reports

Deleting governed evidence never mutates EvaluationEvidence or EvaluationReport:

- an `EvidenceAvailabilityOverlay` is a separate, content-addressed status record containing
  evidence/artifact hash, status (`available`, `restricted`, `deleted`), reason, effective time,
  authority, and tombstone hash;
- the original report and `reportPayloadHash` remain unchanged;
- report retrieval joins the latest authorized overlay for display without changing original bytes;
- a new derived report may reference the original payload hash and overlay hashes, but receives a
  new payload hash;
- reproduction is `complete`, `partial`, or `impossible` based on currently available required
  evidence, and this status is external to the original report.

## Profile and report compatibility

Runs/reports are directly comparable only when manifest comparison intent, calculation bundle
schema, evaluator compatibility class, MetricCatalog hash, ScoringProfile hash, required metric
set, evidence capability/coverage class, and environment class match. A tested adapter may declare
specific compatible differences. Otherwise comparisons are component-only or `incomparable`;
missing visual/retention categories are never renormalized into equivalence with a future full
profile.
