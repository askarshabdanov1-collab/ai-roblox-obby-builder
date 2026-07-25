# Phase E1 — deterministic rule-based evaluator plan

## Objective

Implement a repository-first, test-driven evaluator that deterministically analyzes a validated
SceneManifest and emits an explainable, content-addressed report without Studio, screenshots,
external models, reference data, human labels, analytics, scraping, training, or desktop work.

Proposed branch:

`feat/phase-e1-rule-based-evaluator`

Development remains branch/PR based and must not change Phase 0 PlaceSpec/SceneManifest unless a
test-backed requirement cannot be represented by evaluator-owned contracts and an ADR approves the
change.

## E1 scope

- evaluator-owned contracts and generated TypeScript types;
- canonical native-Part geometry facts;
- safe-route graph and transition facts;
- Phase 0-compatible coarse gaps, rises, drops, and landing checks;
- checkpoint order/route/respawn policy checks available from manifest evidence;
- hazard overlap/safe-margin checks;
- finish reachability;
- conservative softlock and unintended route-skip candidates;
- gameplay/decorative collision and object-budget checks;
- deterministic metric, finding, evidence, and report generation;
- local CLI and fixtures;
- byte/hash determinism and security/resource bounds.

E1 outputs static or heuristic findings; it does not claim exact Roblox physics.

## Dependencies

Reuse:

- `@obby/canonical-json` for canonical serialization and hashes;
- `@obby/contracts` to validate SceneManifest inputs;
- generated-contract workflow patterns;
- Vitest/TypeScript repository toolchain.

No new runtime dependency should be added unless the standard library/current workspace cannot meet
a proven need and the dependency passes license/security/pinning review. No Roblox Studio or Python
runtime is required in E1.

## Task breakdown

### E1.1 — Freeze decisions and fixtures

- Approve E0 contracts/metric subset and add ADR for evaluator determinism/evidence separation.
- Define representative valid and invalid evaluator fixtures:
  - reference vertical slice;
  - exact-limit gap/rise/drop;
  - impossible transition;
  - unreachable finish;
  - bad checkpoint order/route position;
  - unsafe checkpoint/hazard overlap;
  - route softlock candidate;
  - unintended checkpoint/finish skip;
  - decorative collision violation;
  - budget boundary/excess;
  - rotated/wedge approximation;
  - malformed/oversized input.
- Record expected findings and known approximations before implementation.

Acceptance:

- fixture intent and expected evidence subjects are reviewable;
- no Phase 0 generated file is edited manually;
- each planned blocking rule has positive and negative fixtures.

### E1.2 — Evaluator contracts

- Create schemas for the E1 subsets of EvaluationPlan, EvaluationRun, EvaluationEvidence,
  EvaluationMetric, EvaluationFinding, and EvaluationReport.
- Create metric-catalog/scoring-profile schemas or immutable typed definitions.
- Generate TypeScript types and validate structural/semantic layers separately.
- Add canonical hash helpers and version compatibility.
- Explicitly defer ScreenshotView, RuntimeObservation, ReferenceProfile, and HumanPreferenceLabel
  implementation while reserving no unsafe generic payload escape hatch.

Acceptance:

- valid fixtures pass; malformed/unknown/oversized/unsupported versions fail closed;
- generated types drift-check;
- facts, heuristic estimates, and findings cannot be structurally confused;
- every available metric/finding requires evidence IDs.

### E1.3 — Canonical geometry analyzer

- Normalize gameplay/decorative objects into immutable primitives and conservative surfaces.
- Compute centers, bounds, top surfaces, horizontal gaps, vertical rise/drop, overlap, clearance,
  route/world density, and spatial indexing.
- Encode rotated/wedge approximation flags in evidence.
- Reject non-finite/out-of-budget geometry before analysis.

Acceptance:

- boundary tests cover every primitive/axis and touching/separated/overlapping cases;
- input object/array order does not change canonical facts or hashes;
- analyzer never mutates the SceneManifest;
- unsupported geometry yields explicit evidence/failure, not guessed precision.

### E1.4 — Route and transition analyzer

- Resolve spawn → first global safe-route object and every ordered transition by object ID.
- Verify all route references, stage flattening, checkpoint/finish membership, and order.
- Build declared-route and conservative spatial adjacency graphs.
- Emit transition evidence with source/target surface regions and coordinates.

Acceptance:

- hazards, decoration, and construction order never define the safe route;
- route completeness and finish reachability are deterministic;
- unknown/duplicate/missing route targets fail closed;
- evidence points to exact object IDs and route indices.

### E1.5 — Coarse playability rules

- Reproduce Phase 0 coarse gap/rise/drop semantics from explicit avatar profile settings.
- Count impossible transitions, excessive drops, and clearance violations.
- Identify conservative softlock regions and non-adjacent feasible edges that may skip
  checkpoints/stages/finish gating.
- Separate confirmed graph facts from heuristic candidate findings.

Acceptance:

- exact boundary and epsilon tests for all limits;
- impossible required transition and unreachable finish are blocking;
- rotated/wedge cases carry reduced confidence/approximation limitations;
- candidate softlocks/skips never claim exact exploitability.

### E1.6 — Checkpoint, hazard, finish, and policy rules

- Check checkpoint order/route monotonicity and manifest-evidenced respawn geometry.
- Calculate hazard overlap and safe margins around route/landing regions.
- Verify finish is uniquely resolved and coarsely reachable.
- Count decorative collision/touch behavior violations.
- Evaluate part/material/world/object budgets available from manifest facts.

Acceptance:

- known unsafe checkpoint/hazard overlap blocks when required;
- decorative collision violation always blocks;
- no runtime/player-isolation claim is emitted without runtime evidence;
- every rule has a remediation-oriented finding and reproducible coordinates.

### E1.7 — Metric catalog and scoring

- Implement only approved E1 D/H metrics.
- Produce category profile, confidence, blocking failures, caps, and optional aggregate.
- Implement missing/not-applicable/failed distinctly.
- Ensure visual/retention categories are unavailable, not fabricated.

Acceptance:

- impossible route cannot exceed overall cap `20`;
- deterministic blocker output is stable under irrelevant visual/property changes;
- missing metrics are never replaced with a perfect or zero score;
- weights, thresholds, caps, and profile version are visible in report.

### E1.8 — Evidence store and report generation

- Emit content-addressed canonical JSON evidence/report artifacts in a caller-selected workspace
  store.
- Use atomic writes and verify content hashes.
- Generate Markdown from the finalized JSON report.
- Include reproduction versions, configuration hash, findings, evidence index, limitations, and
  missing capabilities.

Acceptance:

- same manifest/plan/evaluator produces byte-identical behavior-bearing JSON and hashes;
- reports contain no absolute machine paths or timestamps inside deterministic hashes;
- corrupted artifact/hash read fails;
- JSON/Markdown agree on outcome, caps, scores, and finding IDs.

### E1.9 — CLI

Proposed commands:

```text
npm run evaluator -- validate-plan <plan.json>
npm run evaluator -- evaluate <scene-manifest.json> --plan <plan.json> --out <directory>
npm run evaluator -- explain <report.json> --finding <finding-id>
```

- CLI uses package application services; no evaluator logic lives in argument parsing.
- Exit codes distinguish pass, findings/fail, invalid input, incomplete evidence, and internal error.
- Output supports machine-readable JSON summary.

Acceptance:

- CLI never overwrites a non-owned output directory;
- path traversal/out-of-workspace behavior is rejected according to caller policy;
- cancellation/interrupt leaves no published partial report;
- end-to-end fixture reports match checked snapshots/hashes.

### E1.10 — CI, documentation, and review

- Add evaluator generation/drift checks to `npm run validate`.
- Document contracts, rules, CLI, limitations, and rule/evidence trace.
- Add security tests, package exports/build smoke, and cross-platform paths.
- Review all blocker thresholds against fixtures before PR readiness.

Acceptance:

- Ubuntu and Windows CI pass;
- dependency/secret checks pass;
- no external model, Studio, scraping, training, analytics, or desktop code/dependency is present;
- Phase 0 fixture/runtime validation remains unchanged and green.

## Exact test strategy

### Contract tests

- Positive valid contract for every E1 schema.
- Mutation matrix: required fields, unknown fields, version mismatch, non-finite/bounds, array
  limits, invalid IDs/hashes, source-kind/value mismatch, evidence-free result.
- Semantic tests: cross-reference integrity, evidence DAG, run/report identity, metric catalog,
  blocking consistency.
- Generated-type and schema drift checks.

### Geometry property/matrix tests

- Table-driven primitives on X/Y/Z boundaries.
- Symmetry under translation and expected axis reflection.
- Same geometry under shuffled object/construction order.
- Exact touching, epsilon gap/overlap, max coordinate/size/budget.
- Rotated/wedge evidence explicitly marked approximate.
- No input mutation.

### Route/playability tests

- Spawn/route/checkpoint/finish graph success and each failure class.
- Gap/rise/drop exact limits and epsilon outside.
- Multiple stages and checkpoint boundaries.
- Hazard/decoration excluded from safe-route derivation.
- Softlock/skip candidates with false-positive control fixtures.
- Score caps and blocking propagation.

### Determinism tests

- Same input/plan/version produces identical canonical evidence/report bytes and hashes across
  repeated runs.
- Shuffled map/object insertion order does not change result.
- Behavior-affecting geometry/plan/profile change changes relevant hashes.
- Informational timestamps/output locations do not change calculation hashes.
- Generated Markdown has deterministic ordering.

### Security/resource tests

- Oversized/deep JSON, excessive objects, invalid numbers, unknown versions.
- Output ownership/path traversal/symlink policy.
- Existing output preservation on failure.
- No credentials/absolute paths in records.
- Atomic publication and corruption detection.

### End-to-end tests

- Evaluate the Phase 0 vertical slice.
- Evaluate every invalid evaluator fixture and assert stable finding IDs/severities/evidence subjects.
- Build/import every new package from plain Node.
- Execute CLI pass/fail/invalid/incomplete exit paths on Windows and Ubuntu.

## Exact root validation commands

Commands expected at E1 completion:

```text
npm ci
npm run contracts:generate
npm run evaluator:fixtures:generate
npm run evaluator:fixtures:check
npm run evaluator:test
npm run evaluator:smoke
npm run validate
git diff --check origin/main...HEAD
git status --short --branch
```

The first four evaluator scripts do not exist in E0; E1 adds them only when their implementations
exist. `npm run validate` remains the complete required gate and must include evaluator checks.

## E1 acceptance criteria

- All E1 contracts are versioned, generated, drift-checked, and fail closed.
- Valid SceneManifest + EvaluationPlan deterministically produces a report with evidence-linked
  metrics/findings.
- Route completeness, transitions, gaps, rises, drops, checkpoints, hazards, finish, candidate
  softlocks/skips, collision policy, and budgets are covered.
- Required-route impossibility/unreachable finish and decorative collision are blocking and cap the
  aggregate.
- Facts and heuristic candidates are visibly separated with confidence/limitations.
- No metric/finding lacks reproducible object/transition/coordinate evidence.
- Same inputs/versions are byte/hash deterministic on Ubuntu and Windows.
- Phase 0 contracts/runtime and generated fixture remain green.
- No external AI/model, Studio bridge/plugin, reference dataset collection, scraping, training,
  analytics collection, MCP adapter, or desktop application is introduced.
- Documentation states that E1 is coarse/static and does not prove exact playability, objective
  visual quality, or retention.

## Risks and mitigations

| Risk                                   | Mitigation                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Coarse geometry overclaims playability | Name model/version, lower confidence for approximations, use “candidate,” require runtime for exact claims |
| Softlock/skip false positives          | Conservative classification, evidence graph, non-blocking default until fixture-calibrated                 |
| Contract overdesign slows delivery     | Implement E1 subsets only; defer runtime/visual/reference/human contracts                                  |
| Duplicate semantics drift from Phase 0 | Reuse validated SceneManifest and shared documented coarse model; parity boundary tests                    |
| Score hides blockers                   | Apply caps after weighting and show blocker/cap trace                                                      |
| Non-determinism from maps/order/time   | Canonical ordering/hashing; exclude informational time/path from behavior hashes                           |
| Monorepo coupling                      | Enforce one-way package dependencies and package import smoke tests                                        |
| Malicious/huge input                   | Contract bounds, resource budgets, fail-before-write, atomic outputs                                       |
| Thresholds lack evidence               | Mark provisional, fixture calibration, catalog versions, stop release if blockers are unstable             |

## Stop conditions

Stop E1 and request architectural review if:

- a required deterministic metric cannot be linked to reproducible evidence;
- implementation requires changing Phase 0 contracts without an approved ADR and migration plan;
- exact Roblox physics claims would be needed to meet acceptance;
- safe-route analysis would need hazards, decoration, or construction order as route truth;
- a score can bypass an impossible-route or collision blocker;
- cross-platform byte/hash determinism cannot be achieved;
- output cannot be published atomically without risking existing user data;
- an external model, Studio automation, scraping, analytics, or desktop dependency becomes necessary;
- new credentials or network access would be required;
- fixture calibration cannot distinguish confirmed failures from heuristic candidates reliably.
