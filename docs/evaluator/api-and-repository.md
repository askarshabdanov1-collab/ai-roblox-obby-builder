# MCP tools, local API, and repository structure

## API principles

- All state-changing requests are authenticated, local, explicit, idempotent where possible, and
  scoped to an immutable manifest hash/execution ID.
- Long-running work is asynchronous. Clients submit a job, receive an opaque ID, observe bounded
  progress, and retrieve immutable results.
- Tool and endpoint responses use the same evaluator contracts.
- Cancellation is explicit and terminal; retry creates a new execution.
- API errors use stable codes and safe messages without secrets or machine-specific paths.
- Production APIs do not accept arbitrary shell commands, Luau, model names, filesystem paths, or
  external URLs.
- E0 implements none of these tools/endpoints.
- Every request resolves content-addressed MetricCatalog and ScoringProfile hashes. Profiles may
  change acceptance/advisory thresholds and invariant display severity, but may never disable,
  weaken, exclude, or downgrade invariant blocking behavior.
- Malformed/incompatible evidence and evaluator integrity/hash failures reject the evaluation.

## Future MCP tools

### `evaluate_obby`

Starts a complete evaluation from a validated plan.

Input:

- SceneManifest artifact/hash;
- EvaluationPlan or approved plan profile ID;
- workspace-local evidence store ID;
- optional idempotency key.

Output:

- `jobId`, `executionId`, `evaluationRequestHash`, accepted `manifestHash`, `configurationHash`,
  `metricCatalogHash`, and `scoringProfileHash`;
- initial status and capability availability;
- status/report resource links.

Rejects invalid hashes, unsupported capabilities, mandatory-metric exclusions, and unsafe budgets
before scheduling.

### `validate_playability`

Runs deterministic geometry/route/checkpoint/hazard/finish checks only.

Input:

- SceneManifest hash/artifact;
- avatar and rule profile;
- requested deterministic metric IDs.

Output:

- finalized deterministic metrics/findings;
- blocking status;
- evidence/report hashes.

This is the primary E1 tool candidate, but MCP exposure follows the underlying library/CLI rather
than preceding it.

### `capture_obby_views`

Future Studio-backed screenshot job.

Input:

- finalized scene/execution identity;
- ordered ScreenshotViews or approved protocol;
- expected Studio session/capabilities;
- timeout/artifact budgets.

Output:

- screenshot evidence/artifact refs;
- observed render/camera settings;
- missing/deviating view records.

It cannot capture an unvalidated or stale scene.

### `compare_scene_variants`

Evaluates or compares two or more variants under one compatible plan.

Input:

- variant IDs and manifest hashes;
- shared EvaluationPlan/profile;
- required evidence-equivalence policy.

Output:

- comparability decision;
- per-metric/category deltas, invariant/profile gate changes, confidence, Pareto summary;
- evidence coverage differences and pairwise human labels where separately available.

The tool returns `incomparable` instead of coercing incompatible executions into a ranking.

### `explain_evaluation`

Retrieves evidence and calculation trace for a report, metric, finding, object, transition, or image
region.

Input:

- report payload hash;
- selector;
- depth/artifact-preview limits.

Output:

- source classification;
- ordered evidence graph;
- inputs, thresholds, calculation/profile versions;
- limitations and reproduction steps.

### `suggest_corrections`

Creates advisory, typed correction intents for selected findings.

Input:

- report payload hash and finding IDs;
- current manifest hash;
- allowed correction categories and budgets.

Output:

- non-executable suggestions;
- object/contract fields affected;
- evidence/rationale, predicted tradeoffs, validation/re-evaluation plan.

No scene mutation occurs. Applying suggestions is a separate future approval workflow.

### `record_human_preference`

Records one consented, protocol-valid pairwise label.

Input:

- task ID, left/right artifacts, question/instructions versions;
- choice including tie/uncertain/skip;
- reason codes and optional moderated comment;
- consent/quality-control envelope.

Output:

- `labelId`, `labelPayloadHash`, and `humanJudgmentEnvelopeHash`, or a rejection code.

`labelId` identifies the label record. `labelPayloadHash` identifies the immutable subjective
judgment and presentation payload. `humanJudgmentEnvelopeHash` binds that payload to its
study/session, pseudonymous rater, consent, retention, and semantic time context. No fourth identity
is defined for a label or judgment.

It is unavailable unless the labeling study and retention policy are enabled.

### `submit_runtime_evidence`

Studio bridge submits a bounded batch of observations/artifacts.

Input:

- authenticated Studio session, execution, manifest, generation, sequence range;
- RuntimeObservations/EvaluationEvidence envelopes;
- artifact hashes and sizes.

Output:

- accepted/rejected sequence IDs;
- next expected sequence;
- execution evidence completeness.

Out-of-order, replayed, stale, oversized, or wrong-scene evidence is rejected.

## Future local HTTP API

Proposed prefix: `/api/evaluator/v1`.

| Method and endpoint                              | Behavior                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `POST /executions`                               | Validate plan/manifest and create asynchronous execution                                      |
| `GET /executions/{executionId}`                  | Execution status, stage progress, capability completeness                                     |
| `POST /executions/{executionId}/cancel`          | Idempotently request cancellation                                                             |
| `GET /executions/{executionId}/events?after=`    | Bounded progress/event stream or polling cursor                                               |
| `GET /executions/{executionId}/report`           | Final report metadata/content reference                                                       |
| `GET /reports/{reportPayloadHash}`               | Immutable deterministic machine-readable report payload                                       |
| `GET /reports/{reportPayloadHash}/explain`       | Filtered evidence/calculation graph                                                           |
| `GET /reports/{reportPayloadHash}/availability`  | Ordered applicable `AvailabilityRecord` values and `availabilityRecordHash` identities        |
| `POST /reports/{reportPayloadHash}/derive`       | Produce a new report from named `availabilityRecordHash` inputs without changing the original |
| `GET /evidence/{evidenceId}`                     | Evidence envelope subject to workspace access                                                 |
| `GET /availability/{availabilityRecordHash}`     | One immutable evidence/artifact/reference availability assertion                              |
| `GET /artifacts/{hash}`                          | Stream authorized content-addressed artifact with range/size limits                           |
| `POST /comparisons`                              | Create asynchronous compatible-variant comparison                                             |
| `GET /comparisons/{jobId}`                       | Comparison status/result                                                                      |
| `POST /studio/sessions`                          | Begin user-confirmed localhost Studio handshake                                               |
| `DELETE /studio/sessions/{sessionId}`            | End bridge session and trigger cleanup                                                        |
| `POST /studio/executions/{executionId}/evidence` | Authenticated evidence batch submission                                                       |
| `POST /preferences`                              | Record an enabled-study HumanPreferenceLabel                                                  |
| `POST /correction-proposals`                     | Generate advisory correction proposal                                                         |

No endpoint in E0 is implemented. The Studio feasibility milestone adds only a pure repository
guard model; it does not implement a local HTTP, WebSocket, MCP, or Studio endpoint.

## Asynchronous job semantics

### Creation and idempotency

- Client supplies an idempotency key scoped to workspace, endpoint, and authenticated session,
  together with `evaluationRequestHash`.
- `evaluationRequestHash` is computed only from `EvaluationRequestPreimage` in
  [Evaluation contract design](contracts.md#configuration-preimage-types). That preimage includes
  scene identity, EvaluationPlan `configurationHash`, evaluator constraint, requested
  profile/catalog identities, evidence requirements, deterministic request options, and explicitly
  ordered outputs. It excludes its own hash, request/job/execution/session IDs, submission time,
  caller/workspace identity, transport/retry/authentication metadata, paths, and logs.
- The hash contains no execution/session ID or wall-clock timestamp. Semantic sets use the named
  stable ordering; requested output order is preserved. The same semantic request produces the same
  hash, so retries may reuse it. Every accepted execution still receives a distinct `executionId`.
- Same scoped key and `evaluationRequestHash` returns the original job; the same key with a
  different hash returns conflict.
- Accepted response is `202` with job/execution ID and status endpoint.

### Status

Statuses mirror EvaluationRun. Progress includes completed/active stage IDs and evidence counts, not
an invented percentage when duration is unknown.

### Events

- Cursor is opaque and execution-scoped.
- Events are bounded, ordered, resumable, and safe to repeat.
- Clients must fetch final execution/report as source of truth.
- Progress events are not persisted as evaluation evidence unless promoted through a contract.

### Cancellation and retry

- `cancel` is idempotent.
- Terminal jobs cannot return to running.
- Retry creates a new execution with `supersedesExecutionId`.
- Non-idempotent Studio capture/runtime stages are never silently retried; the plan decides whether
  a new session/attempt is allowed and records it.

### Error model

Examples:

- `EVAL_CONTRACT_INVALID`;
- `EVAL_MANIFEST_HASH_MISMATCH`;
- `EVAL_CAPABILITY_UNAVAILABLE`;
- `EVAL_REQUIRED_EVIDENCE_MISSING`;
- `EVAL_STALE_SCENE`;
- `EVAL_STAGE_TIMEOUT`;
- `EVAL_CANCELLED`;
- `EVAL_ARTIFACT_HASH_MISMATCH`;
- `EVAL_COMPARISON_INCOMPATIBLE`;
- `EVAL_RATE_LIMITED`;
- `EVAL_INTERNAL`.

Errors include retryability and stage/field pointers where safe. Internal stacks remain local.

### Report and profile compatibility

Comparison requires compatible report-payload schema, calculation bundle, MetricCatalog,
ScoringProfile compatibility class, required evidence capability/coverage, and affected environment
profiles. Exact hashes are required unless a reviewed adapter names both hashes and proves preserved
semantics. A display-only severity change does not change invariant status. Incompatible profiles
yield `EVAL_COMPARISON_INCOMPATIBLE`; the API never renormalizes absent visual or retention
categories. Evidence deletion is exposed only through immutable `AvailabilityRecord` values
identified by `availabilityRecordHash`, or through newly hashed derived reports.

## Proposed repository structure

Create folders only when their phase begins and responsibility is exercised:

```text
packages/
├── obby-evaluator-contracts/   # Evaluation JSON Schemas, generated types, structural validation
├── geometry-evaluator/         # Canonical native-Part geometry and spatial facts
├── playability-evaluator/      # Route, transition, checkpoint, hazard, finish, and skip rules; static softlocks deferred
├── composition-evaluator/      # Future deterministic image features and visual-worker adapters
└── scoring-engine/             # Metric catalog, caps, confidence, profiles, report assembly

apps/
├── evaluator-cli/              # Local evaluate/validate/explain commands
└── review-dashboard/           # Future evidence and human-review UI

workers/
└── visual-evaluator/           # Future pinned/sandboxed model worker; separate dependency boundary

mcp/
└── obby-evaluator/             # Future MCP adapter over evaluator application services

datasets/
└── reference-metadata/         # Future metadata/manifests only; governed artifacts stay external
```

### Ownership and dependency direction

```text
obby-evaluator-contracts
        ↑
geometry-evaluator
        ↑
playability-evaluator
        ↑
scoring-engine
        ↑
evaluator-cli / future MCP / future dashboard

composition-evaluator → scoring-engine through contracts
visual worker → composition adapter through a versioned process/API boundary
```

- Evaluator contracts may depend on shared canonical JSON utilities, but not on analyzers/apps.
- Geometry has no Studio, visual model, dataset, analytics, or UI dependency.
- Playability depends on evaluator contracts and geometry facts.
- Scoring depends on metric/evidence contracts, not analyzer internals.
- Apps compose packages; packages never import apps.
- Visual model dependencies stay isolated from the Node/Roblox deterministic workspace.
- Dataset artifacts are not committed to Git; approved metadata and snapshot manifests may be.

### E1 folders

Folders are introduced only in the phase that owns their first behavior:

- **E1a:** `packages/obby-evaluator-contracts` and `packages/geometry-evaluator`;
- **E1b:** `packages/route-playability-evaluator`;
- **E1c:** `packages/scoring-engine` and `apps/evaluator-cli`.

The dashboard, visual worker, MCP adapter, and dataset metadata wait for phases that exercise them.

## Security and privacy defaults

- API defaults to loopback and an ephemeral authenticated desktop session.
- Workspace access is by opaque ID; canonicalized paths remain inside configured roots.
- Artifact upload is content-type/size bounded and quarantined until hash validation.
- Rate, concurrency, timeout, and storage quotas are enforced per workspace/session.
- Reference URLs cannot be fetched by generic API tools; ingestion is a separate governed flow.
- Analytics and preference endpoints are disabled unless an approved study/calibration feature is
  configured.
- Logs use stable IDs and redact payloads by default.
