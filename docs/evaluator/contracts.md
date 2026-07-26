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

| Type                | Fields and constraints                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContentHash`       | `sha256:` followed by 64 lowercase hexadecimal characters                                                                                      |
| `EvaluatorVersion`  | Semantic version plus optional build hash                                                                                                      |
| `ExecutionId`       | UUIDv7 or another sortable opaque ID; unique per attempt                                                                                       |
| `EvidenceId`        | Stable kind/subject ID plus evidence content hash                                                                                              |
| `MetricId`          | Namespaced kebab ID such as `playability.route-completeness`                                                                                   |
| `ObjectRef`         | `objectId`, optional `role`, manifest hash                                                                                                     |
| `TransitionRef`     | `fromObjectId`, `toObjectId`, global route indices                                                                                             |
| `Point3`            | Finite bounded `x`, `y`, `z` in studs                                                                                                          |
| `ImageRegion`       | Normalized `[0,1]` `x`, `y`, `width`, `height`, screenshot evidence ID                                                                         |
| `Confidence`        | `value` in `[0,1]`, `basis`, `limitations[]`, `sampleCount?`                                                                                   |
| `SourceKind`        | `deterministic`, `heuristic`, `learned`, `analytics-derived`, `subjective`, `derived`                                                          |
| `Severity`          | `info`, `warning`, `error`, `blocking`                                                                                                         |
| `ArtifactRef`       | content hash, media type, byte length, store key, retention class                                                                              |
| `VersionRef`        | component name, semantic version, build/config hash                                                                                            |
| `ControllerProfile` | Versioned coarse limits, avatar landing footprint, supported surfaces, tolerance policy, constant classifications, and `controllerProfileHash` |

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
- `metricDefinitionHash` computed only from `MetricDefinitionPreimage`.

### `MetricCatalog`

- ordered MetricDefinitions with unique IDs/versions;
- invariant registry and non-overridable behavior;
- catalog semantic version plus `metricCatalogHash` computed only from
  `MetricCatalogPreimage`;
- supported evaluator/contract ranges;
- no mutable “latest” definition inside a finalized execution.

### `ScoringProfile`

- profile ID/version plus `scoringProfileHash` computed only from
  `ScoringProfilePreimage`;
- required/optional metric IDs, category/display configuration, evidence completeness rules;
- profile-selectable acceptance and advisory thresholds;
- optional experimental aggregation configuration;
- explicit compatibility class.

A ScoringProfile may change display severity for an invariant finding, but cannot change its
`blocking: true`, invariant ID, outcome effect, or evidence requirements. Profiles cannot exclude,
weaken, waive, or downgrade registered invariants.

## `ControllerProfile`

E1b defines a closed controller/avatar profile for deterministic coarse analysis. Its
`avatarDimensions` object intentionally contains only landing-footprint `width` and `depth`.
Avatar height is excluded from the contract and hash because Phase 0/E1a has no authoritative
overhead route envelope; vertical-clearance evaluation remains unavailable. Every limit is
classified `invariant`, `provisional`, or `calibration-required`; no value is presented as live or
exact Roblox physics. `controllerProfileHash` is computed from the named
`ControllerProfilePreimage`, excluding its own hash, all timestamps, execution/session IDs,
host/environment metadata, and storage metadata. Supported-surface and limitation sets sort by
their stable text identity. Equivalent semantic profiles hash identically; every behavior-affecting
profile change changes the hash.

The E1b coarse transition result is the authoritative public classification contract: transition
and endpoint identity, controller profile ID/version/hash, input evidence hashes, model-relative
state, stable reason codes, deterministic non-probabilistic confidence semantics, limitations, and
versioned normalized reproduction inputs. `inputEvidenceHashes` contains only verified emitted
evidence parents. The profile hash remains in `controllerProfileHash`, and normalized input identity
uses `normalizedInputHash`. Gap/rise/drop measurements are closed, explicitly tagged `available` or
`unavailable` variants. Available measurements require canonically ordered, duplicate-free
`evidenceHashes`; full evaluation resolves them to emitted geometry and route records. Standalone
classification has no evidence graph, so its available measurements explicitly carry empty
`evidenceHashes` and its result carries an empty `inputEvidenceHashes`. Evidence-backed
classification validates the supplied complete graph under an expected manifest, selects exactly
one matching route-transition record with required geometry/route parents, ignores unrelated valid
records, and emits only that selected hash. Missing required measurements and unavailable landing
regions produce `indeterminate`; missing tags, mixed variants, extra fields, malformed hashes, graph
integrity failures, wrong subjects/manifests, and ambiguous matches are typed validation errors. For exact planar Block/Wedge landing regions,
intrinsic edge spans must satisfy
`available + max(profileTolerance, geometryTolerance) >= avatarSpan + 2 * landingMargin` on both
sorted axes. Circular and curved landing regions are indeterminate.

## `EvaluationPlan`

An immutable request describing what evidence and scores are required.

| Field                             | Design                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                   | Evaluator plan contract version                                                                                                                 |
| `planId`                          | Stable caller-provided kebab ID                                                                                                                 |
| `scene`                           | `manifestHash`, `schemaVersion`, optional content-addressed manifest artifact                                                                   |
| `profile`                         | scoring profile ID, version, content hash, and compatibility class                                                                              |
| `catalog`                         | metric catalog ID, version, and content hash                                                                                                    |
| `requiredCapabilities`            | Subset of `geometry`, `route`, `coarse-jump`, `runtime-controller-trials`, `runtime`, `screenshots`, `visual`, `reference`, `analytics`         |
| `views`                           | Ordered `ScreenshotView` specifications or protocol IDs                                                                                         |
| `avatarProfiles`                  | Ordered rig/controller/movement parameter references                                                                                            |
| `deviceProfiles`                  | Ordered viewport/performance classes                                                                                                            |
| `metricInclude` / `metricExclude` | Bounded stable metric IDs; unknown IDs fail                                                                                                     |
| `budgets`                         | Per-stage timeout, total timeout, memory, evidence bytes, screenshot count                                                                      |
| `partialEvidencePolicy`           | `reject`, `finalize-with-missing`, or capability-specific map                                                                                   |
| `comparisonGroupId?`              | Shared group for variant comparison                                                                                                             |
| `seed`                            | Integer used only by explicitly seeded evaluator operations                                                                                     |
| `createdAt`                       | Informational; excluded from deterministic configuration hash                                                                                   |
| `configurationHash`               | Sole deterministic EvaluationPlan identity; hash of `EvaluationPlanConfigurationPreimage`, which never hashes the containing plan or this field |

Semantic rules include: required metrics must have required capabilities; runtime controller trials
require a compatible Studio capability; visual requires screenshots; reference and analytics
require approved immutable snapshot hashes; exclusions cannot remove invariant metrics.

## `EvaluationRun`

The lifecycle and execution-specific identity of one attempt.

| Field                                                         | Design                                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`, `executionId`, `planId`                      | Execution identity; `executionId` is random/unique                                                                                                     |
| `manifestHash`, `configurationHash`                           | Pinned scene and EvaluationPlan behavior identities                                                                                                    |
| `evaluatorVersion`, `metricCatalogHash`, `scoringProfileHash` | Reproduction identities                                                                                                                                |
| `status`                                                      | `queued`, `validating`, `analyzing`, `collecting-runtime`, `capturing`, `analyzing-visuals`, `scoring`, `finalized`, `rejected`, `cancelled`, `failed` |
| `stageStates[]`                                               | Stage ID, attempt, status, timestamps, timeout, error code                                                                                             |
| `startedAt`, `finishedAt?`                                    | Execution-specific UTC timestamps                                                                                                                      |
| `supersedesExecutionId?`                                      | New execution created as retry/re-evaluation                                                                                                           |
| `sessionIds[]`                                                | Ordered opaque Studio/playtest session identities used by this execution                                                                               |
| `capabilityResults[]`                                         | Capability, `complete`/`partial`/`missing`/`failed`, evidence IDs                                                                                      |
| `environment`                                                 | OS/architecture and applicable Studio/engine/renderer/GPU/driver/locale/colorspace settings                                                            |
| `calculationBundleHash?`, `reportPayloadHash?`                | Deterministic outputs when finalized                                                                                                                   |
| `failure?`                                                    | Stable code, safe message, stage, retryability; no stack trace secrets                                                                                 |
| `executionEnvelopeHash`                                       | Hash of `ExecutionEnvelopePreimage`; the preimage includes execution-specific identity/timing but excludes this field                                  |

Terminal runs are immutable. Progress messages are transient and are not part of the finalized
contract. `executionEnvelopeHash` is computed once on terminal transition; intermediate lifecycle
states have no finalized envelope hash.

## `EvaluationEvidence`

An envelope for one reproducible evidence item.

| Field                              | Design                                                                                                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `evidenceId`      | Content identity                                                                                                                                                                                                     |
| `executionId?`                     | Optional execution provenance; always excluded from `EvidenceContentPreimage` and included only by a named execution-envelope preimage                                                                               |
| `kind`                             | Existing kinds plus E1b `route-graph`, `coarse-transition-state`, `route-playability-summary`, `transition-evidence-conflict`, `checkpoint-topology`, `finish-topology`, `hazard-relationship`, and `skip-candidate` |
| `sourceKind`                       | One of the six source classifications                                                                                                                                                                                |
| `manifestHash`, `generationToken?` | Scene binding; `generationToken` is execution-envelope-only                                                                                                                                                          |
| `subject`                          | Object refs, transition refs, coordinates, image regions, or whole-scene scope                                                                                                                                       |
| `producer`                         | Component/model/collector version and configuration hash                                                                                                                                                             |
| `capturedAt?`                      | Wall-clock provenance; execution-envelope-only and absent for static evidence                                                                                                                                        |
| `monotonicOffsetMs?`               | Required content for runtime observations/performance samples; absent for every other evidence kind                                                                                                                  |
| `payload`                          | Discriminated union keyed by `kind`; generic unvalidated maps are prohibited                                                                                                                                         |
| `artifactRefs[]`                   | Content-addressed screenshots/log chunks/etc.                                                                                                                                                                        |
| `parentEvidenceIds[]`              | Inputs used to derive this evidence                                                                                                                                                                                  |
| `quality`                          | Completeness, validity checks, confidence where non-deterministic                                                                                                                                                    |
| `limitations[]`                    | Required for non-deterministic evidence                                                                                                                                                                              |
| `evidenceContentHash`              | Hash of the kind-discriminated `EvidenceContentPreimage`; execution-envelope fields are governed by fixed kind rules                                                                                                 |

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
| `calculationHash`                                                    | Hash of `MetricCalculationPreimage`; the preimage excludes this field                                                                  |

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

| Field                                | Design                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `schemaVersion`, `reportPayloadHash` | Deterministic identity computed from `ReportPayloadPreimage`; this field is not in that preimage |
| `calculationBundleHash`              | Ordered behavior-bearing input/evidence/calculation identity                                     |
| `scene`, `plan`, `versions`          | Manifest/plan/config/evaluator/catalog/profile content hashes                                    |
| `outcome`                            | `pass`, `pass-with-warnings`, `fail-under-profile`, `fail`, `incomplete`                         |
| `blockingFindingIds[]`               | Deterministic list                                                                               |
| `scoreProfile`                       | Category results, confidence, and classified optional experimental aggregation when permitted    |
| `metrics[]`                          | Ordered embedded metric results or references                                                    |
| `findings[]`                         | Ordered finding references                                                                       |
| `evidenceIndex[]`                    | Evidence ID, kind, hash, artifact refs                                                           |
| `missingEvidence[]`                  | Capability/metric, reason, consequence                                                           |
| `comparability`                      | Comparison group/profile and compatible dimensions                                               |
| `limitations[]`                      | Report-wide limitations and prohibited interpretations                                           |

Ordering and hash membership are defined by `ReportPayloadPreimage`. `generatedAt`, execution ID,
local paths, and renderer metadata are not report-payload fields. A rendered Markdown/HTML report is
a separate artifact identified by `reportRenderHash`, computed only from `ReportRenderPreimage`.

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
| `artifact`                                   | Image `ArtifactRef` plus `screenshotBinaryHash`, `screenshotProtocolMetadataHash`, and execution-specific `screenshotEvidenceEnvelopeHash`                                    |

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
| `runtimeObservationContentHash`                              | Deterministic observation content identity                                                                                                                                                                       |
| `runtimeObservationEnvelopeHash`                             | Execution-specific observation envelope identity                                                                                                                                                                 |

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
| `labelPayloadHash`                   | Immutable judgment/presentation payload identity                    |
| `humanJudgmentEnvelopeHash`          | Rater/session/governance envelope identity                          |

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

### Canonicalization policy

All deterministic JSON preimages, including `EvaluationRequestPreimage` and
`AvailabilityRecordPreimage`, use the versioned algorithm `obby-canonical-json-v1` and SHA-256.
This design does not claim RFC 8785 compliance.

`obby-canonical-json-v1` has these mandatory rules:

- A hash identity field is always excluded from its own canonical preimage.
- Encode canonical JSON as UTF-8 without a byte-order mark or trailing whitespace.
- Normalize every string and object key to Unicode NFC before ordering or encoding. Reject an object
  if normalization makes two keys equal.
- Sort object keys by normalized Unicode scalar-value order.
- Accept only finite IEEE-754 binary64 numbers within contract bounds. Encode the shortest
  round-trippable base-10 representation; when fixed and exponent forms have equal length, choose
  the lexicographically smaller form. Use lowercase `e`, no exponent `+`, and no leading exponent
  zeros; normalize `-0` to `0`. Reject `NaN` and positive/negative infinity.
- Reject `undefined`, sparse array entries, functions, binary values, and non-JSON host objects.
  Omit an absent optional field. `null` is permitted only where the governing schema explicitly
  permits it and is distinct from absence.
- Preserve array order when the contract says order is semantic. For a semantic set, sort by the
  stable key named in its preimage definition; reject duplicate stable keys.
- A preimage starts with `canonicalizationAlgorithm: "obby-canonical-json-v1"` and the applicable
  preimage/schema version, so a canonicalization change produces a new identity domain.
- Build one trusted descriptor snapshot and serialize it once. Hash exactly the bytes returned by
  the named helper. Reject enumerable accessors, inherited enumerable properties, symbol keys,
  unexpected prototypes, Date/Map/Set/typed arrays/class instances, trap failures, cycles, and
  normalized-key collisions. A transparent stable Proxy cannot be portably branded and is accepted
  only insofar as its inspected descriptors are observationally ordinary and stable.
- Default resource limits are depth 64, 4,096 enumerable properties per object, 100,000 array
  entries, 200,000 visited nodes, and 16 MiB canonical UTF-8. Exceeding a limit produces a typed
  deterministic validation error.

The existing Phase 0 `@obby/canonical-json` 0.2.0 default API retains its prior byte identity.
Evaluator hash helpers use separately named `obby-canonical-json-v1` APIs; this is not a silent
Phase 0 identity migration.

Direct binary hashes use SHA-256 over the exact stored bytes and do not use JSON canonicalization.
A subject stable key is the kind-prefixed tuple: object `objectId`; transition
`fromObjectId/toObjectId/fromGlobalIndex/toGlobalIndex`; image region
`screenshotEvidenceId/x/y/width/height`; or the literal `scene` for whole-scene scope. Coordinates
use their canonical numeric representations.

### Configuration preimage types

`MetricDefinitionPreimage` contains exactly:

- `canonicalizationAlgorithm`, `schemaVersion`, `metricId`, `metricVersion`, `resultKind`;
- value schema, unit, range, applicability, and `zeroObservationBehavior`;
- required evidence kinds/capabilities;
- calculation/rule implementation identity and deterministic configuration;
- confidence method, invariant ID/blocking eligibility, profile threshold definitions, advisory
  thresholds, and each constant's [I]/[P]/[C] classification;
- normalization rule, limitations template, comparison compatibility class, and calibration status.

It excludes `metricDefinitionHash`, creation/update timestamps, author/reviewer identity, comments,
and mutable display prose.

`MetricCatalogPreimage` contains exactly:

- `canonicalizationAlgorithm`, `schemaVersion`, catalog ID/version;
- `metricDefinitionHashes[]`, sorted by the referenced `metricId` then `metricVersion`;
- invariant registry entries sorted by invariant ID;
- supported evaluator/contract ranges sorted by component name.

It references metric-definition hashes rather than embedding definitions. It excludes
`metricCatalogHash`, creation/update timestamps, authoring metadata, review state, and mutable
display prose.

`ScoringProfilePreimage` contains exactly:

- `canonicalizationAlgorithm`, `schemaVersion`, profile ID/version, `metricCatalogHash`;
- required and optional metric IDs, each sorted lexicographically;
- invariant gate references sorted by invariant ID;
- profile acceptance/advisory thresholds, category configuration/weights, evidence-completeness
  rules, optional experimental aggregation configuration, and all [I]/[P]/[C] classifications;
- display-severity mapping and comparison compatibility rules.

It excludes `scoringProfileHash`, creation/update timestamps, author/reviewer identity, comments,
and non-semantic presentation prose. Reordering an input set does not change the hash; changing a
semantically ordered rule list does.

`EvaluationPlanConfigurationPreimage` contains all behavior-affecting `EvaluationPlan` fields:
`schemaVersion`, `planId`, `scene`, `profile`, `catalog`, `requiredCapabilities`, `views`,
`avatarProfiles`, `deviceProfiles`, `metricInclude`, `metricExclude`, `budgets`,
`partialEvidencePolicy`, `comparisonGroupId`, and `seed`. Set-like ID/capability fields are sorted;
ordered view/avatar/device arrays retain declared order. It excludes `configurationHash`,
`createdAt`, execution identity, and caller storage/location metadata.

`configurationHash` is the sole deterministic identity for EvaluationPlan behavior. There is no
second plan hash.

`EvaluationRequestPreimage` contains exactly:

- `canonicalizationAlgorithm`, `schemaVersion`;
- `scene`, containing `manifestHash` and `manifestSchemaVersion`;
- the EvaluationPlan `configurationHash`;
- `evaluatorVersionConstraint`;
- `profile`, containing `profileId`, `profileVersion`, `scoringProfileHash`, and
  `compatibilityClass`;
- `catalog`, containing `catalogId`, `catalogVersion`, and `metricCatalogHash`;
- `requestedEvidenceRequirements` containing required capability IDs, evidence-kind IDs, and
  coverage-profile IDs, with each semantic set sorted lexicographically;
- `deterministicRequestOptions` containing `seed`, `partialEvidencePolicy`, and
  `comparisonGroupId`; these values must equal their EvaluationPlan values or validation fails;
- `requestedOutputs[]`, an explicitly ordered list of typed descriptors containing `outputKind`,
  optional `outputFormat`, and optional named `renderProfileId`. Output kinds are
  `report-payload`, `rendered-report`, `evidence-index`, or `explanation`; arbitrary option maps are
  prohibited.

It excludes `evaluationRequestHash`, request/job/execution/session IDs, submission or processing
timestamps, caller/user identity, workspace-local storage identity, transport and retry metadata,
API authentication/authorization data, local paths, and logs. It contains no wall-clock timestamp
or execution/session ID. The declared `requestedOutputs[]` order is semantic; all other set-like
fields use the stable ordering above. The same semantic request produces the same
`evaluationRequestHash`; retries may reuse it, while each accepted runtime execution still receives
a distinct `executionId`.

`MetricCalculationPreimage` contains `canonicalizationAlgorithm`, schema version,
`metricDefinitionHash`, deterministic parameters, `evidenceContentHash` values sorted by evidence
kind, subject stable key, then hash, parent metric `calculationHash` values sorted by parent metric
ID then hash, typed result/status, thresholds applied, confidence calculation inputs/result, and
limitations sorted by stable limitation code then text. It excludes its own `calculationHash`,
execution IDs, wall-clock timestamps, and display severity that does not affect the metric result.

### Execution and calculation preimage types

`ExecutionEnvelopePreimage` contains exactly these `EvaluationRun` fields:

- `schemaVersion`, `executionId`, `planId`, `manifestHash`, `configurationHash`;
- `evaluatorVersion`, `metricCatalogHash`, `scoringProfileHash`;
- terminal `status`; `stageStates[]` including stage ID, attempt/retry number, status, start/end
  timestamps, timeout, and error code;
- `startedAt`, `finishedAt`, `supersedesExecutionId`, and ordered Studio/playtest `sessionIds[]`;
- `capabilityResults[]`, full recorded `environment`, `calculationBundleHash`,
  `reportPayloadHash`, and `failure`.

Stage states retain stage-DAG order then attempt number; capabilities sort by capability ID; session
IDs retain acquisition order. It excludes `executionEnvelopeHash`, transient progress events,
process IDs, host/user identity, local paths, secrets, and diagnostic stack/log text.
`executionId`, session IDs, retry attempts, timestamps, and recorded runtime/environment metadata
are intentionally included because this hash identifies one execution.

`CalculationBundlePreimage` contains exactly:

- `canonicalizationAlgorithm`, calculation-bundle schema version, `manifestHash`,
  `configurationHash`, `evaluatorVersion`, `metricCatalogHash`, and `scoringProfileHash`;
- the semantic environment compatibility class, not raw machine identity;
- required `evidenceContentHash` values sorted by evidence kind, subject stable key, then hash;
- rule/analyzer implementation `VersionRef` values sorted by component name.

It excludes `calculationBundleHash`, execution/session IDs, wall-clock timestamps, process/host/user
identity, raw machine metadata outside the compatibility class, retry attempts, transient/local
paths, non-semantic log ordering, render-only settings, and calculated output presentation.
Equivalent deterministic inputs therefore produce the same `calculationBundleHash` in separate
executions.

### Evidence preimage types and fixed kind rules

`EvidenceContentPreimage` is a discriminated union keyed by `kind`. Every variant starts with
`canonicalizationAlgorithm`, evidence schema version, `kind`, `manifestHash`, typed `subject`,
producer/configuration identity, typed payload, parent content hashes sorted lexicographically,
artifact content hashes sorted by artifact role then hash, `quality`, and limitations sorted by
stable limitation code then text. It never contains `evidenceContentHash`, `evidenceId`,
`executionId`, `capturedAt`, a storage key, or machine identity. The following table is exhaustive
for the current evidence kinds; a new kind requires a new versioned variant before use.

| Evidence kind                  | Additional content fields included                                                                                                                              | Content fields excluded and envelope rule                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `geometry-fact`                | Object IDs sorted by object ID; normalized primitive/coordinate payload; evaluator geometry-rule version                                                        | Excludes execution/session/generation identity, all timestamps, and machine/runtime metadata                       |
| `route-graph`                  | Route/stage identity, ordered nodes/transitions, spawn/checkpoint/finish membership, structural state, reproduction inputs                                      | Excludes construction order, execution/session identity, timestamps, and machine/runtime metadata                  |
| `route-transition`             | From/to object IDs, route indices, normalized surface/coordinate payload, route-rule version                                                                    | Excludes execution/session/generation identity, all timestamps, and machine/runtime metadata                       |
| `coarse-transition-state`      | Metric/result/transition identity, controller profile hash/version, model-relative state, measurements, surfaces, tolerance, reproduction                       | Excludes execution identity and any universal physics/impossibility claim                                          |
| `route-playability-summary`    | Model-relative state/drop counts, explicit clearance availability, route identity, reproduction                                                                 | Excludes scoring, approval, and silent substitution for missing clearance evidence                                 |
| `transition-evidence-conflict` | Separate coarse/runtime evidence hashes, typed conflict state, transition identity, reproduction                                                                | Excludes source replacement; E1b defines the payload but collects no runtime evidence                              |
| `checkpoint-topology`          | Route/stage/index/order, structural reachability, authority, per-player progression scope, explicit runtime-isolation absence, reproduction                     | Excludes runtime isolation verdicts and Studio observations                                                        |
| `finish-topology`              | Required finish membership/count/order, structural/coarse path state, authority, reproduction                                                                   | Excludes approval/score and execution metadata                                                                     |
| `hazard-relationship`          | Hazard/route subjects, overlap/full-consumption/kill-floor/enclosure relationship, candidate assessment, bounded geometry method, authority, reproduction       | Excludes confirmation where only broad-phase geometry exists                                                       |
| `skip-candidate`               | Non-adjacent endpoints/indexes, typed bypass/spawn-late/checkpoint-finish/stage-skip classes, skipped stages, candidate state, broad-phase method, reproduction | Excludes claims that the candidate is executable                                                                   |
| `runtime-observation`          | `runtimeObservationContentHash` defined below                                                                                                                   | Execution/session/generation/wall-clock fields live only in `RuntimeObservationEnvelopePreimage`                   |
| `screenshot`                   | `screenshotBinaryHash` and `screenshotProtocolMetadataHash`                                                                                                     | Capture execution/session/generation/time live only in `ScreenshotEvidenceEnvelopePreimage`                        |
| `image-feature`                | Input artifact hashes, feature/model/configuration hashes, typed feature payload, semantic environment compatibility class                                      | Excludes execution IDs, wall-clock time, raw host identity, and environment fields outside the compatibility class |
| `performance-sample`           | Runtime sample content using the runtime-observation rule, device/render profile, ordered sample offsets and typed counters                                     | Its execution/session/generation/wall-clock fields live only in the runtime envelope                               |
| `reference-comparison`         | Candidate feature hashes, approved reference snapshot hash, comparison implementation/configuration, typed result                                               | Excludes mutable reference aliases, execution IDs, wall-clock time, and local source locations                     |
| `analytics-aggregate`          | `querySpecificationHash`, `sourceSnapshotHash`, `privacyConfigurationHash`, and `aggregationResultHash`                                                         | Excludes query execution ID/time, analyst/host identity, and mutable dataset aliases                               |
| `human-label`                  | `labelPayloadHash`                                                                                                                                              | Rater/session/consent/retention/time fields live only in `HumanJudgmentEnvelopePreimage`                           |

`RuntimeObservationContentPreimage` contains observation schema version, observation `kind`,
`manifestHash`, subject, player slot, controller/avatar profile, collector and engine/runtime
versions, sequence number, monotonic relative time, ordered event/sample payload, result, and
content artifact hashes. It excludes `runtimeObservationContentHash`, `observationId`, `executionId`,
`sessionId`, `generationToken`, `observedAt`, and machine identity. Wall-clock time is never a
content field. If wall-clock time is the measured subject, a separately versioned observation kind
stores the measured value inside its typed payload; `observedAt` remains envelope-only.

`RuntimeObservationEnvelopePreimage` contains the `runtimeObservationContentHash`,
`observationId`, `executionId`, `sessionId`, `generationToken`, `observedAt`, and collector sequence.
It excludes `runtimeObservationEnvelopeHash`. This identity is intentionally execution-specific.

Screenshot evidence uses three separate identities:

- `ScreenshotBinaryPreimage` is the exact image-file byte sequence.
  `screenshotBinaryHash` is its SHA-256; no pixel normalization is performed in draft-0.
- `ScreenshotProtocolMetadataPreimage`: `canonicalizationAlgorithm`, screenshot schema version,
  `manifestHash`, `viewId`, protocol version, requested and observed camera/render/viewport/engine
  settings, OS/scaling/DPI/device-pixel ratio, renderer/API, GPU/driver, locale, colorspace,
  artifact media type/dimensions/byte length, validity results, and `screenshotBinaryHash`. It
  excludes `screenshotProtocolMetadataHash`, execution/session/generation IDs, capture wall-clock
  time, and local path.
- `ScreenshotEvidenceEnvelopePreimage`: `screenshotBinaryHash`,
  `screenshotProtocolMetadataHash`, `evidenceId`, `executionId`, `sessionId`, `generationToken`, and
  `capturedAt`. It excludes `screenshotEvidenceEnvelopeHash`.

A future normalized pixel identity requires a new named algorithm and field; it cannot reuse
`screenshotBinaryHash`.

Human judgment evidence uses two identities:

- `HumanLabelPayloadPreimage`: label schema version, task/question/instructions versions, left/right
  artifact identities, randomized display order, complete presentation profile, choice, reason
  codes, moderated comment, and quality-control result. It excludes `labelPayloadHash`, `labelId`,
  pseudonymous rater identity, study/session identity, `createdAt`, consent version, and retention
  class.
- `HumanJudgmentEnvelopePreimage`: `labelPayloadHash`, `labelId`, rater pseudonym, study/session
  identity, `createdAt`, consent version, and retention class. It excludes
  `humanJudgmentEnvelopeHash`.

Thus identical immutable judgments shown under identical presentation conditions can share a
payload hash, while different raters/sessions retain distinct envelopes. Human-label aggregation
counts distinct `humanJudgmentEnvelopeHash` inputs; it never deduplicates observations only because
their `labelPayloadHash` values match.

Analytics-derived evidence uses four identities:

- `AnalyticsQuerySpecificationPreimage`: schema/query versions, metric definition, source fields,
  filters, grouping, cohort eligibility, observation-window semantics, and aggregation method.
- `AnalyticsSourceSnapshotPreimage`: snapshot schema/version, immutable source partitions/content
  hashes, event-schema versions, and bounded release/experiment identities.
- `AnalyticsPrivacyConfigurationPreimage`: policy version, cohort minimums, suppression/noise rules,
  and allowed output fields.
- `AnalyticsAggregationResultPreimage`: `querySpecificationHash`, `sourceSnapshotHash`,
  `privacyConfigurationHash`, ordered typed result rows, sample/effective-sample counts,
  uncertainty, and integrity checks.

Their respective hashes exclude their own hash field, execution/query wall-clock time,
analyst/host identity, local paths, and mutable aliases. Result rows sort by the query's declared
grouping-key order. No evidence producer selects hash fields dynamically.

### Report preimage types

`RenderedBytesPreimage` is the exact rendered output byte sequence.

`ReportPayloadPreimage` contains exactly:

- `canonicalizationAlgorithm`, report schema version, `calculationBundleHash`;
- `scene`, `plan`, and `versions` including manifest, EvaluationPlan `configurationHash`, evaluator,
  `metricCatalogHash`, and `scoringProfileHash`;
- `outcome`, sorted `blockingFindingIds`, `scoreProfile`, canonically ordered `metrics`, `findings`,
  `evidenceIndex`, `missingEvidence`, `comparability`, and `limitations`.

Metrics sort by category then metric ID; findings sort by invariant/profile blocking status, rule
ID, subject stable key, then finding ID; evidence sorts by kind, subject stable key, then evidence
ID. Blocking finding IDs sort lexicographically; score-profile categories sort by category ID;
missing evidence sorts by capability then metric ID; comparison set fields sort lexicographically;
limitations sort by stable limitation code then text. It excludes `reportPayloadHash`,
`executionId`, all execution/export timestamps, local paths, rendering/template/locale metadata, UI
state, and execution-envelope fields. Equivalent evaluation results in separate executions must
produce the same `reportPayloadHash`.

`ReportRenderPreimage` contains exactly `canonicalizationAlgorithm`, render-preimage schema version,
`reportPayloadHash`, renderer name/version, template version, locale, formatting configuration,
output format, and `renderedBytesHash` (SHA-256 of the exact output bytes). It excludes
`reportRenderHash`, export timestamp, local output path, UI state, and host identity. An export
timestamp must not appear in rendered bytes; if a timestamp is intentionally displayed, its fixed
value is a semantic `displayedTimestamp` inside formatting configuration and therefore participates
in the hash. Rendered bytes must not embed `reportRenderHash`; that identity is sidecar metadata
(rendered output may display `reportPayloadHash`). Different renderer or template versions may
produce different `reportRenderHash` values from the same `reportPayloadHash`.

### Complete hash-domain matrix

| Hash field              | Canonical preimage                        | Included fields                                                                                                                          | Excluded fields                                                                                                        | Ordering                                                                          | Timestamp policy                                                                               | Execution/random-ID policy                 | Environment policy                                                           | Equivalent-input rule                                                        |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `metricDefinitionHash`  | `MetricDefinitionPreimage`                | All semantic metric fields listed above                                                                                                  | Own hash, authoring time/identity, comments, mutable prose                                                             | Evidence kinds and semantic sets sort by stable ID; semantic rule order preserved | No timestamps                                                                                  | No random/execution IDs                    | Only semantic compatibility requirements                                     | Same semantic definition gives the same hash                                 |
| `metricCatalogHash`     | `MetricCatalogPreimage`                   | Catalog ID/version, ordered definition hashes, invariant registry, supported ranges                                                      | Own hash, authoring metadata/time, mutable prose                                                                       | Definitions by metric ID/version; invariants by ID; ranges by component           | No timestamps                                                                                  | No random/execution IDs                    | No machine metadata                                                          | Same referenced definitions/registry/ranges give the same hash               |
| `scoringProfileHash`    | `ScoringProfilePreimage`                  | Profile/catalog identity, metrics, gates, thresholds, weights/status, completeness, display and compatibility rules                      | Own hash, authoring metadata/time, comments                                                                            | Set-like IDs sorted; semantic rule order preserved                                | No timestamps                                                                                  | No random/execution IDs                    | Compatibility rules only                                                     | Semantic input reordering does not change the hash                           |
| `controllerProfileHash` | `ControllerProfilePreimage`               | Schema/profile/model versions, classified limits, avatar landing width/depth, landing margin, supported surfaces, tolerance, limitations | Own hash, timestamps, execution/session IDs, host/environment/storage metadata; avatar height is not an admitted field | Supported surfaces and limitations sort lexicographically                         | No timestamps                                                                                  | No execution/session/random IDs            | No live host/engine environment                                              | Same semantic controller profile gives the same hash                         |
| `configurationHash`     | `EvaluationPlanConfigurationPreimage`     | All behavior-affecting plan fields listed above                                                                                          | Own hash, `createdAt`, execution/storage metadata                                                                      | Set-like fields sorted; declared arrays preserved                                 | `createdAt` excluded                                                                           | No execution/random IDs                    | Named device/avatar/view profiles included; host metadata excluded           | Same plan behavior gives the same hash                                       |
| `evaluationRequestHash` | `EvaluationRequestPreimage`               | Scene/configuration, evaluator constraint, profile/catalog, evidence requirements, deterministic options, outputs                        | Own hash, request/job/execution/session IDs, submission time, caller/workspace/transport/retry/auth data               | Requirement sets sorted; requested output order preserved                         | No timestamps                                                                                  | No execution/session/random IDs            | Named requested profiles included; caller/host/transport metadata excluded   | Same semantic request matches; retries may reuse the hash                    |
| `calculationHash`       | `MetricCalculationPreimage`               | Definition, parameters, ordered evidence/parents, result, classified thresholds/confidence, limitations                                  | Own hash, execution/timestamps, display-only severity                                                                  | Evidence/parents by contract stable key                                           | No timestamps                                                                                  | No execution/random IDs                    | Only evidence-bound semantic environment                                     | Same metric calculation gives the same hash                                  |
| `executionEnvelopeHash` | `ExecutionEnvelopePreimage`               | Listed EvaluationRun fields including execution/session IDs, attempts, timestamps, full environment and output hashes                    | Own hash, transient progress/logs, process/host/user identity, paths, secrets                                          | Stage DAG/attempt, capability ID, session acquisition order                       | Execution start/end and stage timestamps included                                              | Execution/session IDs and retries included | Full recorded runtime environment included; host identity excluded           | Separate executions are expected to differ                                   |
| `calculationBundleHash` | `CalculationBundlePreimage`               | Manifest/configuration/evaluator/catalog/profile, semantic environment class, evidence hashes, rule versions                             | Own hash, execution/session IDs, timestamps, processes/hosts, retries, logs, paths, render-only settings               | Evidence by kind/subject/hash; rules by component                                 | No timestamps                                                                                  | No execution/random IDs                    | Compatibility class included; raw machine metadata excluded                  | Equivalent deterministic inputs must match                                   |
| `evidenceContentHash`   | Kind variant of `EvidenceContentPreimage` | Fixed fields in the exhaustive evidence-kind table                                                                                       | Own hash/ID plus envelope-only fields fixed by kind                                                                    | Kind-specific stable keys above                                                   | No wall-clock timestamps; runtime relative time is included only by its named content preimage | No execution/session/random envelope IDs   | Included only where the named kind rule lists a semantic environment/profile | Semantically identical content under the same kind rule must match           |
| `reportPayloadHash`     | `ReportPayloadPreimage`                   | `calculationBundleHash`, scene/plan/versions, outcome, profile, metrics/findings/evidence/missing/comparability/limitations              | Own hash, execution/export fields, paths, render/UI metadata                                                           | Canonical metric/finding/evidence orders above                                    | No timestamps                                                                                  | No execution/random IDs                    | Only identities already bound by calculation/evidence                        | Equivalent results across executions must match                              |
| `reportRenderHash`      | `ReportRenderPreimage`                    | Payload hash, renderer/template/locale/format config, output format, rendered-bytes hash                                                 | Own hash, export time, path, UI/host state                                                                             | Object-key canonicalization; rendered bytes hashed exactly                        | Export time excluded; intentional displayed time is semantic config                            | No execution/random IDs                    | Renderer identity/config included; host identity excluded                    | Same payload/render config/bytes match; renderer/template changes may differ |

Supporting evidence identities follow the same complete policy:

| Hash field                       | Canonical preimage                      | Included fields                                                                                                    | Excluded fields                                                                      | Ordering                                                              | Timestamp policy                                                                  | Execution/random-ID policy                                | Environment policy                                          | Equivalent-input rule                          |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `runtimeObservationContentHash`  | `RuntimeObservationContentPreimage`     | Observation kind/scene/subject/slot/profile/versions, sequence, relative time, payload/result/artifacts            | Own hash, observation/execution/session/generation IDs, wall clock, machine identity | Event/sample sequence preserved; set fields sorted                    | Relative time included; wall clock excluded                                       | Player slot included; random/envelope IDs excluded        | Controller/avatar and engine/runtime versions included      | Same empirical content/profile/version matches |
| `runtimeObservationEnvelopeHash` | `RuntimeObservationEnvelopePreimage`    | Content hash, observation/execution/session/generation IDs, observed time, collector sequence                      | Own hash, local receipt/path/log metadata                                            | Collector sequence preserved                                          | `observedAt` included                                                             | Execution/session/observation/generation IDs included     | Already bound by content hash                               | Separate captures may differ                   |
| `screenshotBinaryHash`           | `ScreenshotBinaryPreimage`              | Every stored byte                                                                                                  | JSON metadata, paths, timestamps, IDs                                                | Byte order unchanged                                                  | No timestamp outside bytes; draft-0 forbids timestamp injection                   | No IDs outside bytes                                      | No metadata outside bytes                                   | Byte-identical files match                     |
| `screenshotProtocolMetadataHash` | `ScreenshotProtocolMetadataPreimage`    | Scene/view/protocol, requested/observed capture metadata, validity, binary hash                                    | Own hash, execution/session/generation IDs, capture time, path                       | View/protocol arrays use declared order; sets sorted                  | No timestamps                                                                     | No execution/random IDs                                   | Full observed visual environment included                   | Same binary/protocol/observations match        |
| `screenshotEvidenceEnvelopeHash` | `ScreenshotEvidenceEnvelopePreimage`    | Binary/metadata hashes, evidence/execution/session/generation IDs, capture time                                    | Own hash, local path/UI state                                                        | Scalar fields; canonical object-key order                             | `capturedAt` included                                                             | Evidence/execution/session/generation IDs included        | Bound through metadata hash                                 | Separate captures may differ                   |
| `labelPayloadHash`               | `HumanLabelPayloadPreimage`             | Task/question/instructions, items/order/presentation, choice/reasons/comment/QC                                    | Own hash, label/rater/session IDs, time, consent/retention                           | Display order preserved; reason codes sorted                          | No timestamps                                                                     | No random/rater/session IDs                               | Presentation profile included                               | Same judgment and presentation match           |
| `humanJudgmentEnvelopeHash`      | `HumanJudgmentEnvelopePreimage`         | Payload hash, label/rater/study/session IDs, created time, consent/retention                                       | Own hash and local study-system metadata                                             | Canonical object-key order                                            | `createdAt` included                                                              | Label/rater/study/session IDs included                    | Bound through presentation payload                          | Separate raters/sessions may differ            |
| `querySpecificationHash`         | `AnalyticsQuerySpecificationPreimage`   | Query/schema/metric/source fields, filters, grouping, cohort/window/aggregation rules                              | Own hash, query execution/time, author/host/path                                     | Grouping order preserved; filter sets sorted by field/operator/value  | No timestamps except fixed observation-window semantics                           | No execution/random IDs                                   | No machine metadata                                         | Same query semantics match                     |
| `sourceSnapshotHash`             | `AnalyticsSourceSnapshotPreimage`       | Snapshot schema/version, ordered partition/content hashes, event schemas, bounded release/experiment IDs           | Own hash, mutable aliases, collection execution/time, host/path                      | Partitions by stable partition ID; schemas by version ID              | No collection timestamps; event times remain inside source content hashes         | No execution/random IDs outside bounded source identities | No machine metadata                                         | Same immutable source snapshot matches         |
| `privacyConfigurationHash`       | `AnalyticsPrivacyConfigurationPreimage` | Policy version, cohort minimums, suppression/noise rules, allowed outputs                                          | Own hash, authoring time/identity/comments                                           | Rules by stable rule ID                                               | No timestamps                                                                     | No execution/random IDs                                   | No machine metadata                                         | Same privacy behavior matches                  |
| `aggregationResultHash`          | `AnalyticsAggregationResultPreimage`    | Query/source/privacy hashes, ordered rows, sample counts, uncertainty, integrity checks                            | Own hash, execution/time, analyst/host/path, mutable aliases                         | Rows by declared grouping-key order                                   | No timestamps outside typed aggregated values requested by query                  | No execution/random IDs                                   | No machine metadata                                         | Same source/query/privacy/result matches       |
| `renderedBytesHash`              | `RenderedBytesPreimage`                 | Every stored byte                                                                                                  | Paths, export envelope metadata                                                      | Byte order unchanged                                                  | Dynamic export time forbidden; semantic displayed time is already in bytes/config | No IDs outside bytes                                      | No host metadata outside bytes                              | Byte-identical renders match                   |
| `availabilityRecordHash`         | `AvailabilityRecordPreimage`            | Subject, state, reason, authority, semantic effective point, supersession parents, policy, successor, impact scope | Own hash, storage/cache/UI metadata, mutable notes, processing/receipt time          | Parent/affected hashes and reason details sorted by their stable keys | Normalized semantic effective time included; storage/processing times excluded    | No execution/session/random IDs                           | Semantic authority included; host/storage metadata excluded | Same immutable availability assertion matches  |

Semantic equivalence requires exact schema, canonicalization, evaluator,
definition/catalog/profile, rule, evidence-kind, and compatible environment identities; version
strings alone are insufficient.

### Illustrative reproducibility examples

These use placeholders, not computed test vectors.

Two separate executions of equivalent deterministic inputs:

| Field                   | Execution A                    | Execution B                    |
| ----------------------- | ------------------------------ | ------------------------------ |
| `executionId`           | `exec-A`                       | `exec-B`                       |
| `startedAt`             | `2030-01-01T10:00:00Z`         | `2030-01-02T11:00:00Z`         |
| `executionEnvelopeHash` | `sha256:<execution-A>`         | `sha256:<execution-B>`         |
| `calculationBundleHash` | `sha256:<same-calculation>`    | `sha256:<same-calculation>`    |
| `reportPayloadHash`     | `sha256:<same-report-payload>` | `sha256:<same-report-payload>` |

The execution envelope hashes differ because execution identity/time are included; the calculation
and report payload hashes match because their named preimages exclude execution-specific fields.

One deterministic report payload rendered two ways:

| Field               | Renderer/template 1                  | Renderer/template 2              |
| ------------------- | ------------------------------------ | -------------------------------- |
| `reportPayloadHash` | `sha256:<same-report-payload>`       | `sha256:<same-report-payload>`   |
| renderer/template   | `markdown-renderer@1` / `template@1` | `html-renderer@2` / `template@3` |
| `reportRenderHash`  | `sha256:<render-one>`                | `sha256:<render-two>`            |

The payload identity remains stable; the renderer/template identities and output bytes make the
render identities different.

## Evidence availability and immutable reports

Deleting governed evidence never mutates EvaluationEvidence or EvaluationReport:

- an `AvailabilityRecord` is a separate immutable, content-addressed status assertion identified by
  `availabilityRecordHash`;
- the original report and `reportPayloadHash` remain unchanged;
- report retrieval resolves authorized availability records without changing original bytes;
- a new derived report may reference the original payload hash and `availabilityRecordHash` values,
  but receives a new payload hash;
- reproduction is `complete`, `partial`, or `impossible` based on currently available required
  evidence, and this status is external to the original report.

`AvailabilityRecordPreimage` contains exactly:

- `canonicalizationAlgorithm`, availability-record schema version;
- `subject`, a discriminated evidence, artifact, or reference identity containing its kind, stable
  ID when the governing contract has one, and immutable content hash;
- `availabilityState`: `available`, `restricted`, or `deleted`;
- a stable `reasonCode` and bounded typed `reasonDetails[]`;
- `authority`, containing `authorityKind` and `authorityId`;
- exactly one semantic effective point: `effectiveAt` or `effectiveSequence`;
- `supersedesAvailabilityRecordHashes[]`;
- `policy`, a `VersionRef` containing its component name, semantic version, and build/configuration
  hash;
- optional `successor`, containing its kind, stable ID when defined, and immutable content hash;
- `impactScope`, containing `scopeKind` and `affectedIdentityHashes[]`. `scopeKind` is one of
  `subject-only`, `subject-and-derived`, `reference-snapshot`, or `dataset-release`.

It excludes `availabilityRecordHash`, storage path/key, retrieval cache state, UI/display metadata,
mutable notes, receipt/processing timestamps, execution/session IDs, host/user identity, and local
transport metadata.

`authorityKind` is a lowercase kebab-case registered authority class such as `retention-policy`,
`rights-review`, or `source-owner`; `authorityId` is a bounded opaque identifier in the form
`<authorityKind>:<lowercase-kebab-or-uuid>`. Both are semantic and included. Conflicting assertions
remain as distinct immutable records. A later resolution creates a new record that references every
conflicting parent in `supersedesAvailabilityRecordHashes[]`; no record is overwritten.
Supersession references must name records for the same subject and form an acyclic graph. Consumers
select maximal authorized records after applying supersession edges; multiple incomparable maximal
records are an unresolved conflict and required evidence fails closed until a resolution record is
published.

`effectiveAt` is a semantic RFC 3339 UTC instant normalized to uppercase `T`/`Z`; offsets and leap
seconds are rejected, fractional trailing zeros are removed, and a zero fractional component is
omitted. `effectiveSequence` is a non-negative integer within contract bounds. Receipt, storage,
and processing times are never included. Superseded hashes and affected identity hashes sort
lexicographically. Reason details sort by stable reason-detail code then canonical value; duplicate
stable keys are rejected.

The same subject, assertion, semantic effective point, authority, policy, parents, successor, and
impact scope produce the same `availabilityRecordHash`. A status change, conflict resolution, or
correction creates a new record; prior records and hashes remain unchanged.

## Profile and report compatibility

Runs/reports are directly comparable only when manifest comparison intent, calculation bundle
schema, evaluator compatibility class, MetricCatalog hash, ScoringProfile hash, required metric
set, evidence capability/coverage class, and environment class match. A tested adapter may declare
specific compatible differences. Otherwise comparisons are component-only or `incomparable`;
missing visual/retention categories are never renormalized into equivalence with a future full
profile.
