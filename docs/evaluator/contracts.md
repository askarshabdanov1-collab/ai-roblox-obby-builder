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
- explicit source classification: `deterministic`, `heuristic`, `learned`, `analytics-derived`, or
  `subjective`;
- no credentials, local absolute paths, usernames, or private identifiers in persisted records.

Evaluation contracts reference a SceneManifest by immutable hash. They do not copy or modify Phase 0
PlaceSpec/SceneManifest structure.

## Shared primitives

| Type               | Fields and constraints                                                     |
| ------------------ | -------------------------------------------------------------------------- |
| `ContentHash`      | `sha256:` followed by 64 lowercase hexadecimal characters                  |
| `EvaluatorVersion` | Semantic version plus optional build hash                                  |
| `RunId`            | UUIDv7 or another sortable opaque ID; generated once                       |
| `EvidenceId`       | Run-scoped stable ID plus content hash                                     |
| `MetricId`         | Namespaced kebab ID such as `playability.route-completeness`               |
| `ObjectRef`        | `objectId`, optional `role`, manifest hash                                 |
| `TransitionRef`    | `fromObjectId`, `toObjectId`, global route indices                         |
| `Point3`           | Finite bounded `x`, `y`, `z` in studs                                      |
| `ImageRegion`      | Normalized `[0,1]` `x`, `y`, `width`, `height`, screenshot evidence ID     |
| `Confidence`       | `value` in `[0,1]`, `basis`, `limitations[]`, `sampleCount?`               |
| `SourceKind`       | `deterministic`, `heuristic`, `learned`, `analytics-derived`, `subjective` |
| `Severity`         | `info`, `warning`, `error`, `blocking`                                     |
| `ArtifactRef`      | content hash, media type, byte length, store key, retention class          |
| `VersionRef`       | component name, semantic version, build/config hash                        |

## Deterministic facts versus estimates and judgments

The contract model prevents category confusion:

- `fact` values require deterministic evidence, exact units, and reproduction metadata;
- `estimate` values require method, confidence, uncertainty/limitations, and may be heuristic,
  learned, or analytics-derived;
- `judgment` values require a human instruction version, rater/aggregate provenance, tie/uncertain
  support, and cannot be promoted to fact;
- a metric declares exactly one `sourceKind`, although its evidence may include lower-level facts;
- report aggregation retains the original class and may not relabel it.

## `EvaluationPlan`

An immutable request describing what evidence and scores are required.

| Field                             | Design                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`                   | Evaluator plan contract version                                                                                          |
| `planId`                          | Stable caller-provided kebab ID                                                                                          |
| `scene`                           | `manifestHash`, `schemaVersion`, optional content-addressed manifest artifact                                            |
| `profile`                         | scoring profile ID and version                                                                                           |
| `requiredCapabilities`            | Subset of `geometry`, `route`, `coarse-jump`, `exact-jump`, `runtime`, `screenshots`, `visual`, `reference`, `analytics` |
| `views`                           | Ordered `ScreenshotView` specifications or protocol IDs                                                                  |
| `avatarProfiles`                  | Ordered rig/controller/movement parameter references                                                                     |
| `deviceProfiles`                  | Ordered viewport/performance classes                                                                                     |
| `metricInclude` / `metricExclude` | Bounded stable metric IDs; unknown IDs fail                                                                              |
| `budgets`                         | Per-stage timeout, total timeout, memory, evidence bytes, screenshot count                                               |
| `partialEvidencePolicy`           | `reject`, `finalize-with-missing`, or capability-specific map                                                            |
| `comparisonGroupId?`              | Shared group for variant comparison                                                                                      |
| `seed`                            | Integer used only by explicitly seeded evaluator operations                                                              |
| `createdAt`                       | Informational; excluded from deterministic configuration hash                                                            |
| `configurationHash`               | Canonical hash of all behavior-affecting fields                                                                          |

Semantic rules include: required metrics must have required capabilities; exact-jump requires
runtime; visual requires screenshots; reference requires visual features; analytics uses only an
approved first-party snapshot; exclusions cannot remove mandatory blocking playability metrics.

## `EvaluationRun`

The lifecycle and immutable identity of one execution.

| Field                                                               | Design                                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`, `runId`, `planId`                                  | Identity                                                                                                                                               |
| `manifestHash`, `planHash`, `configurationHash`                     | Pinned inputs                                                                                                                                          |
| `evaluatorVersion`, `metricCatalogVersion`, `scoringProfileVersion` | Reproduction versions                                                                                                                                  |
| `status`                                                            | `queued`, `validating`, `analyzing`, `collecting-runtime`, `capturing`, `analyzing-visuals`, `scoring`, `finalized`, `rejected`, `cancelled`, `failed` |
| `stageStates[]`                                                     | Stage ID, attempt, status, timestamps, timeout, error code                                                                                             |
| `startedAt`, `finishedAt?`                                          | UTC timestamps                                                                                                                                         |
| `supersedesRunId?`                                                  | New run created as retry/re-evaluation                                                                                                                 |
| `capabilityResults[]`                                               | Capability, `complete`/`partial`/`missing`/`failed`, evidence IDs                                                                                      |
| `environment`                                                       | OS/architecture, evaluator build, Studio/engine version when applicable                                                                                |
| `failure?`                                                          | Stable code, safe message, stage, retryability; no stack trace secrets                                                                                 |
| `runHash`                                                           | Canonical hash once terminal                                                                                                                           |

Terminal runs are immutable. Progress messages are transient and are not part of the finalized
contract.

## `EvaluationEvidence`

An envelope for one reproducible evidence item.

| Field                                  | Design                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `evidenceId`, `runId` | Identity                                                                                                                                                                      |
| `kind`                                 | `geometry-fact`, `route-transition`, `runtime-observation`, `screenshot`, `image-feature`, `performance-sample`, `reference-comparison`, `analytics-aggregate`, `human-label` |
| `sourceKind`                           | One of the five source classifications                                                                                                                                        |
| `manifestHash`, `generationToken?`     | Scene binding                                                                                                                                                                 |
| `subject`                              | Object refs, transition refs, coordinates, image regions, or whole-scene scope                                                                                                |
| `producer`                             | Component/model/collector version and configuration hash                                                                                                                      |
| `capturedAt?`, `monotonicOffsetMs?`    | Runtime ordering where relevant                                                                                                                                               |
| `payload`                              | Kind-specific bounded structure                                                                                                                                               |
| `artifactRefs[]`                       | Content-addressed screenshots/log chunks/etc.                                                                                                                                 |
| `parentEvidenceIds[]`                  | Inputs used to derive this evidence                                                                                                                                           |
| `quality`                              | Completeness, validity checks, confidence where non-deterministic                                                                                                             |
| `limitations[]`                        | Required for non-deterministic evidence                                                                                                                                       |
| `evidenceHash`                         | Canonical envelope hash                                                                                                                                                       |

Evidence derivation must be acyclic. Every parent must belong to the same manifest/run or be an
explicitly versioned approved reference/calibration snapshot.

## `EvaluationMetric`

A metric result, separate from its catalog definition.

| Field                                                 | Design                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `runId`, `metricId`, `metricVersion` | Identity                                                                                                                               |
| `category`                                            | Playability, readability, checkpoint, hazard, composition, style, performance, difficulty, onboarding, retention-readiness, confidence |
| `sourceKind`                                          | Declared calculation class                                                                                                             |
| `status`                                              | `available`, `not-applicable`, `missing-evidence`, `failed`                                                                            |
| `rawValue`                                            | Typed number, integer, boolean, enum, or bounded vector                                                                                |
| `unit`                                                | Stable unit such as `count`, `ratio`, `studs`, `milliseconds`, `score-0-100`                                                           |
| `normalizedScore?`                                    | `[0,100]`; absent for unscored facts                                                                                                   |
| `confidence`                                          | Required, including deterministic metrics (`1` only when inputs/method are exact)                                                      |
| `severity`                                            | Highest severity triggered                                                                                                             |
| `blocking`                                            | Boolean derived from catalog threshold, never model discretion                                                                         |
| `evidenceIds[]`                                       | Non-empty for available results                                                                                                        |
| `thresholdsApplied`                                   | Catalog/profile version and resolved limits                                                                                            |
| `limitations[]`                                       | Metric-specific caveats                                                                                                                |
| `calculationHash`                                     | Hash of definition, parameters, ordered evidence, and output                                                                           |

## `EvaluationFinding`

An actionable, evidence-backed observation.

| Field                                  | Design                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `findingId`, `runId`  | Identity                                                                                                                |
| `ruleId`, `ruleVersion`, `metricIds[]` | Source rules                                                                                                            |
| `title`, `summary`                     | Safe bounded text generated from templates where deterministic                                                          |
| `severity`, `blocking`                 | Profile-resolved classification                                                                                         |
| `sourceKind`                           | Inherited from rule/metric                                                                                              |
| `subjects`                             | Object IDs, transitions, coordinates, views, image regions                                                              |
| `evidenceIds[]`                        | Required                                                                                                                |
| `reproduction`                         | Analyzer inputs or Studio steps without machine-specific paths                                                          |
| `suggestedCorrection?`                 | Advisory typed intent, affected object IDs, predicted tradeoffs                                                         |
| `limitations[]`                        | Why the finding may be incomplete                                                                                       |
| `disposition?`                         | Future human state: `unreviewed`, `accepted`, `rejected`, `duplicate`, `waived`; waiver includes reviewer/reason/expiry |

Suggested corrections do not contain executable scripts and cannot be automatically applied.

## `EvaluationReport`

The finalized output that ties the run together.

| Field                                              | Design                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `schemaVersion`, `reportId`, `runId`, `reportHash` | Identity                                                             |
| `scene`, `plan`, `versions`                        | Manifest/plan/config/evaluator/catalog/profile hashes                |
| `outcome`                                          | `pass`, `pass-with-warnings`, `fail`, `incomplete`                   |
| `blockingFindingIds[]`                             | Deterministic list                                                   |
| `scoreProfile`                                     | Category scores, confidence, caps, weighted aggregate when permitted |
| `metrics[]`                                        | Ordered embedded metric results or references                        |
| `findings[]`                                       | Ordered finding references                                           |
| `evidenceIndex[]`                                  | Evidence ID, kind, hash, artifact refs                               |
| `missingEvidence[]`                                | Capability/metric, reason, consequence                               |
| `comparability`                                    | Comparison group/profile and compatible dimensions                   |
| `limitations[]`                                    | Run-wide limitations and prohibited interpretations                  |
| `generatedAt`                                      | UTC timestamp                                                        |

Ordering is canonical: category, metric ID, finding severity/rule/subject, evidence ID.

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
| `observed`                                   | Actual camera/render/viewport/engine settings                                                                                                                                 |
| `artifact`                                   | Image `ArtifactRef`                                                                                                                                                           |

## `RuntimeObservation`

One ordered Studio fact or measurement.

| Field                                                  | Design                                                                                                                                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `observationId`, `runId`, `sessionId` | Identity                                                                                                                                                                                                         |
| `manifestHash`, `generationToken`, `playerSlot?`       | Scope                                                                                                                                                                                                            |
| `sequence`, `monotonicOffsetMs`, `observedAt`          | Ordering                                                                                                                                                                                                         |
| `kind`                                                 | `scene-loaded`, `character-spawned`, `checkpoint-activated`, `character-died`, `character-respawned`, `finish-touched`, `softlock-candidate`, `transition-attempt`, `frame-sample`, `log-event`, `capture-ready` |
| `subject`                                              | Object/transition/player-slot refs and position/orientation                                                                                                                                                      |
| `value`                                                | Kind-specific bounded payload                                                                                                                                                                                    |
| `collectorVersion`, `engineVersion`                    | Reproduction                                                                                                                                                                                                     |
| `validity`                                             | Required scene/generation/session checks                                                                                                                                                                         |

Player slots are evaluator-local pseudonyms, never Roblox usernames or user IDs.

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
- An evaluator run pins all contract versions. Mixed-version evidence is rejected unless an
  explicit, tested adapter is listed in the plan.
