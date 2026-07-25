# Phase E1 — staged deterministic evaluator plan

## Objective and shared boundaries

E1 delivers a deterministic, static evaluator in three focused pull requests. It consumes a
validated SceneManifest and produces progressively richer, evidence-linked results. Its coarse
geometry model never claims exact Roblox physics.

All three phases exclude visual ML, Studio automation, runtime controller trials, screenshots,
reference-data acquisition, scraping, analytics ingestion, human labeling, MCP, desktop UI, cloud
infrastructure, automatic corrections, and changes to Phase 0 gameplay behavior.

The non-overridable invariants are malformed/incompatible required inputs or evidence,
integrity/hash failure that makes evaluation untrustworthy, incomplete/unreachable required route
topology, unreachable finish topology, confirmed cross-player/cross-scene checkpoint leakage, and
decorative collision/touch behavior affecting gameplay. E1 has no runtime evidence and therefore
cannot claim checkpoint isolation passed. Profiles may alter invariant display severity, never
blocking status or outcome effect.

E1 coarse transitions use only `feasible-under-model`, `infeasible-under-model`, and
`indeterminate`. A conservative profile may return `fail-under-profile` for model-relative
infeasibility. Only a future approved proof standard may use "impossible."

## Command ownership

Existing Phase 0 commands remain unchanged and are not described as missing.

| Command                                | Owner/introduction                                 | Purpose                                               |
| -------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| `npm run contracts:generate`           | Existing Phase 0                                   | Generate PlaceSpec/SceneManifest contract outputs     |
| `npm run validate`                     | Existing aggregate gate; extended by each E1 phase | Run all checks owned by the repository                |
| `npm run evaluator:contracts:generate` | E1a                                                | Generate evaluator contract types only                |
| `npm run evaluator:contracts:check`    | E1a                                                | Fail when evaluator generated contracts drift         |
| `npm run evaluator:test`               | E1a, expanded in E1b/E1c                           | Run implemented evaluator unit/property/fixture tests |
| `npm run evaluator:fixtures:generate`  | E1c                                                | Regenerate finalized end-to-end report fixtures       |
| `npm run evaluator:fixtures:check`     | E1c                                                | Drift-check finalized evaluator fixtures              |
| `npm run evaluator:smoke`              | E1c                                                | Build/import packages and exercise CLI end to end     |
| `npm run evaluator -- ...`             | E1c                                                | Run the evaluator CLI                                 |

`npm run validate` becomes the only required aggregate gate and invokes only scripts that exist in
the current phase. Evaluator contracts use their own commands because their schemas and generated
types have a separate ownership/drift boundary from Phase 0 contracts.

## E1a — contracts and geometry foundation

**Branch:** `feat/phase-e1a-evaluator-contracts-geometry`

### Exact scope

- Add bounded Draft 2020-12 evaluator schemas and generated TypeScript types for the E1 subsets of
  EvaluationPlan, deterministic/heuristic/derived evidence and metric results, EvaluationFinding,
  deterministic EvaluationReport payload, execution envelope, EvidenceAvailabilityOverlay,
  MetricDefinition, MetricCatalog, and ScoringProfile.
- Implement structural then semantic validation, canonical JSON, content hashes, compatibility
  checks, and immutable fixture identities.
- Define a content-addressed E1 MetricCatalog and an E1-specific profile with categories available
  in E1 only; no aggregate score.
- Add valid/invalid fixtures before behavior.
- Add immutable native-Part geometry primitives, centers, bounds, supported top surfaces, overlap,
  horizontal gap, rise/drop input facts, clearance inputs, and approximation markers.
- Enforce finite-number, coordinate, size, depth, object-count, and byte budgets before analysis.

No route verdict engine, topology verdict, coarse transition state, scoring workflow, CLI, report
renderer, evidence store, or Studio/runtime behavior is included.

### Acceptance criteria and tests

- Every metric result is structurally one of deterministic fact, heuristic estimate, learned
  estimate, analytics-derived estimate, human judgment, or derived composite; E1 accepts only its
  supported variants and no generic payload escape hatch.
- Catalog/profile hashes and execution/calculation/evidence/report hash domains match the contracts
  document; random IDs and timestamps cannot change deterministic identities.
- Valid fixtures pass; unknown fields/versions/kinds, malformed hashes, non-finite/oversized/deep
  inputs, source/value mismatch, mixed sources, and broken evidence DAGs fail closed.
- Geometry tests cover every primitive/axis, touching/separated/overlap boundaries, epsilon cases,
  translation/reflection properties, shuffled input order, unsupported rotation/wedge
  approximations, and no input mutation.
- Same valid input/config/version produces byte-identical geometry evidence on Ubuntu and Windows.

### Root validation commands

```text
npm ci
npm run contracts:generate
npm run evaluator:contracts:generate
npm run evaluator:contracts:check
npm run evaluator:test
npm run validate
git diff --check origin/main...HEAD
git status --short --branch
```

**Rollback boundary:** remove the two new packages and their root-script/workspace registrations;
no Phase 0 schema or generated fixture is migrated.

**Stop conditions:** schema needs an unbounded/generic payload; hashes differ cross-platform;
geometry requires engine simulation; Phase 0 contracts require an unapproved breaking migration;
or bounds cannot reject before allocation/work.

**Expected PR size:** medium, approximately 25–45 focused source/test/schema/generated files; split
generated output mechanically but keep contracts and geometry together only while review remains
tractable.

## E1b — route and coarse playability evidence

**Branch:** `feat/phase-e1b-route-playability-evidence`

### Exact scope

- Build the declared global safe-route/stage graph only from committed route metadata.
- Validate references, order, stage continuity, checkpoint/finish membership, unique finish, and
  required-route topology.
- Emit source/target geometry evidence and per-transition coarse states using an explicit
  avatar/model profile.
- Emit `coarse-infeasible-transition-count`, indeterminate count, excessive-drop and clearance
  estimates, checkpoint topology/respawn-geometry facts, hazard-route overlap/safe-margin facts or
  estimates, and conservative softlock/skip candidates.
- Preserve conflicting future coarse/runtime components as separate evidence plus a derived conflict
  result; E1b fixtures model the contract but do not run Studio.
- Store developer-fixture evidence in memory or test-owned temporary directories only.

No aggregate/category scoring, finalized report workflow, public CLI, persistent workspace evidence
store, runtime isolation verdict, or external integration is included.

### Acceptance criteria and tests

- Hazards, decoration, spatial proximity, and construction order never define the safe route.
- Unknown/duplicate route targets, missing required topology, and unreachable finish fail as
  invariants with deterministic object/transition evidence.
- +X/-X/+Z/-Z and diagonal transitions, multiple stages/checkpoints, declared model limits, epsilon
  outside limits, vertical-only/degenerate inputs, rotated/wedge approximations, and shuffled order
  are covered.
- Coarse states never use "impossible"; runtime trials are represented as empirical
  controller/avatar/engine evidence and cannot overwrite the coarse component.
- Softlock/skip candidates are heuristic and have false-positive-control fixtures.
- Zero checkpoint-isolation opportunities produce `missing-evidence`, not pass; no multiplayer
  isolation claim is emitted.

### Root validation commands

```text
npm ci
npm run evaluator:contracts:check
npm run evaluator:test
npm run validate
git diff --check origin/main...HEAD
git status --short --branch
```

**Rollback boundary:** remove `packages/playability-evaluator` and its fixtures/tests; E1a contracts
and geometry remain independently usable.

**Stop conditions:** route truth would depend on hazards/decoration/order; a heuristic must be
misreported as deterministic; blocker evidence is not reproducible; model boundaries cannot be
tested; or runtime/Studio access becomes necessary.

**Expected PR size:** medium, approximately 20–40 focused source/test/fixture files.

## E1c — scoring, reports, CLI, and end-to-end fixtures

**Branch:** `feat/phase-e1c-scoring-reports-cli`

### Exact scope

- Apply invariant gates before E1 profile acceptance thresholds and advisory category results.
- Implement E1-only playability, checkpoint, hazard, policy, and performance category results,
  confidence calculations, evidence completeness, missing/not-applicable/incomplete states, and no
  aggregate score.
- Assemble content-addressed evidence, deterministic report payloads, renderer-specific Markdown,
  availability overlays, and newly hashed derived reports.
- Add a local CLI for plan validation, evaluation, and finding explanation with stable exit codes,
  atomic caller-owned output, interruption safety, and machine-readable summaries.
- Add end-to-end valid/invalid fixtures and deterministic report snapshots/hashes.

Visual/retention categories remain `unavailable` and are never renormalized. No Studio/manual upload
workflow, external data, automated correction, API server, MCP, or dashboard is included.

### Acceptance criteria and tests

- Invariants cannot be waived, excluded, severity-downgraded in outcome, or offset by category
  results. Model-relative coarse failures are separately `fail-under-profile`.
- All weights, thresholds, confidence/completeness rules, and coverage requirements are classified
  [I], [P], or [C]; E1 exposes no scientifically implied aggregate.
- Reports include catalog/profile/calculation hashes, component evidence, limitations, missing
  capabilities, and compatibility class. Incompatible profiles are not directly compared.
- Same manifest/plan/catalog/profile/evaluator produces byte-identical evidence and report payload
  hashes across repeated Ubuntu/Windows runs despite new execution IDs/timestamps.
- Original reports remain unchanged after an evidence overlay; derived reports get new hashes and
  reproduction becomes complete/partial/impossible as defined.
- CLI tests cover pass, fail, fail-under-profile, invalid, incomplete, cancel/interruption, path
  traversal/symlink policy, existing-output preservation, corruption, and package import.

### Root validation commands

```text
npm ci
npm run evaluator:contracts:check
npm run evaluator:fixtures:generate
npm run evaluator:fixtures:check
npm run evaluator:test
npm run evaluator:smoke
npm run validate
git diff --check origin/main...HEAD
git status --short --branch
```

**Rollback boundary:** remove scoring-engine/CLI packages and E1c reports/fixtures/root scripts;
E1a geometry/contracts and E1b evidence analyzers remain valid libraries.

**Stop conditions:** any score can clear an invariant; report identity includes execution
randomness; output cannot publish atomically; profile comparison silently renormalizes missing
categories; stable cross-platform fixtures fail; or an excluded integration becomes necessary.

**Expected PR size:** medium, approximately 25–45 focused source/test/fixture/generated files. Split
the CLI/report renderer from scoring before review if that bound is exceeded.

## Shared risk controls and final E1 acceptance

- Tests precede behavior and every finding links to stable object/transition/coordinate evidence.
- Generated files are changed only through their owning commands and drift-checked.
- Input order, output path, execution ID, and timestamps do not change calculation or report payload
  identity.
- Uncalibrated constants are visibly [P]/[C]; missing evidence is never converted to zero, perfect,
  or a renormalized score.
- Phase 0 validation remains green throughout.
- Each pull request is independently revertible and contains no external model, Studio, scraping,
  analytics, desktop, MCP, cloud, or credential dependency.
