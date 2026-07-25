# Metric taxonomy and scoring model

## Decision layers

The evaluator keeps three mechanisms separate:

1. **Invariant safety/integrity gates** are catalog-owned, non-overridable conditions required to
   trust or approve a scene.
2. **Profile-selectable acceptance thresholds** express product/device targets and may conservatively
   block publication for a named profile without claiming universal failure.
3. **Advisory scoring thresholds** produce warnings or category scores and never change invariant
   status.

A ScoringProfile may change the display severity or wording of an invariant finding, but cannot
disable, exclude, weaken, waive, downgrade, or change its `blocking: true` status or outcome effect.

Non-overridable invariants are:

- malformed, incompatible, missing-required, or hash-invalid evaluator inputs/evidence where the
  evaluation cannot be trusted;
- disconnected/missing declared required route topology;
- unresolved or topologically unreachable finish;
- confirmed cross-player or cross-scene checkpoint leakage;
- decorative collision/touch behavior that affects gameplay;
- any future required-route impossibility established by an approved proof standard.

The E1 coarse model does not meet that proof standard. A conservative publication profile may block
on `infeasible-under-model`, but the report must call the decision model-relative.

## Metric definition requirements

Every MetricDefinition is versioned/content-addressed and defines:

- one stable ID/name/category and exactly one result variant/source kind;
- required evidence, calculation, value type/unit/range and applicability;
- zero-observation behavior;
- calculation-based confidence semantics and limitations;
- invariant ID, profile-selectable threshold, and advisory threshold as separate fields;
- normalization only when scored;
- comparison compatibility class, catalog tests, and calibration status.

Each future learned, analytics, or human source emits a separate component metric. Fusion produces a
`derived-composite` with ordered parent metric IDs; mixed labels such as `H/L/S` are prohibited.

Constant classifications used below:

- **[I] justified invariant:** structural/integrity condition, not profile-overridable;
- **[P] provisional engineering default:** useful for prototypes, not scientifically validated;
- **[C] calibration-required:** unavailable for production scoring until held-out calibration.

Numeric score scales such as `[0,100]` describe representation, not validated quality intervals.
All weights, confidence mappings, caps, coverage requirements, and thresholds are [P] or [C] unless
explicitly marked [I].

## Playability and route metrics

| ID / result kind                                                         | Inputs and calculation                                                                                                        | Range and confidence                                                                                                                                               | Decision behavior                                                                                                    | Limitations                                                                  |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `playability.route-completeness` / deterministic fact                    | Manifest route IDs, gameplay objects, declared graph. Ratio of resolvable declared transitions plus spawn-to-finish topology. | `[0,1]`; confidence `1` after exact contract/graph resolution.                                                                                                     | [I] `<1` blocks because declared topology is incomplete.                                                             | Does not assert physical feasibility.                                        |
| `playability.coarse-transition-state` / heuristic estimate               | Canonical surfaces, avatar profile and Phase 0 gap/rise/drop model per transition.                                            | Enum `feasible-under-model`, `infeasible-under-model`, `indeterminate`; confidence method uses primitive support and approximation coverage, not a fixed constant. | [P] conservative profiles may block publication on `infeasible-under-model`; never universal invariant.              | Rotation, wedges, momentum, controls and dynamic mechanics may be unmodeled. |
| `playability.coarse-infeasible-transition-count` / derived composite     | Count component transition states equal to `infeasible-under-model`.                                                          | Integer `0..routeTransitions`; confidence propagates from parent states.                                                                                           | [P] profile acceptance threshold; finding must say model-relative.                                                   | Must not be named or reported as “impossible.”                               |
| `playability.indeterminate-transition-count` / derived composite         | Count indeterminate component states with a deterministic aggregation rule.                                                   | Integer; exact aggregation of parent statuses.                                                                                                                     | Missing required resolution may make a profile incomplete; not a failure by itself.                                  | Indicates insufficient model coverage.                                       |
| `playability.required-route-topology-reachability` / deterministic fact  | Spawn, safe-route graph and finish identity, ignoring physical feasibility.                                                   | Boolean; confidence `1`.                                                                                                                                           | [I] false blocks.                                                                                                    | A true result does not prove traversability.                                 |
| `playability.runtime-controller-transition-result` / deterministic fact  | Observed pinned controller/avatar/engine trial result, attempt policy and transforms.                                         | Per-attempt success/failure plus coverage.                                                                                                                         | Empirical evidence only; finite failures never establish universal impossibility.                                    | Profile/environment-specific and sensitive to trial driver quality.          |
| `playability.transition-evidence-conflict` / derived composite           | Compare coarse state and compatible runtime trial components.                                                                 | `agree`, `runtime-success-vs-coarse-infeasible`, `runtime-failure-vs-coarse-feasible`, `insufficient-runtime`, `incompatible`.                                     | Conflict prevents silent source replacement; profile declares whether review or more evidence is required.           | Runtime failure may be driver failure, not geometry failure.                 |
| `playability.excessive-drop-count` / heuristic estimate                  | Surface heights and avatar/profile drop limit.                                                                                | Integer; confidence derived from primitive/landing coverage.                                                                                                       | [P] profile threshold; invariant only if a separate exact lethal-overlap fact proves required-route failure.         | Large drops may use mechanics absent from the manifest.                      |
| `playability.softlock-candidate-count` / heuristic estimate              | Conservative spatial graph and represented recovery/reset paths.                                                              | Integer; confidence from graph/mechanic coverage.                                                                                                                  | Advisory or [P] review gate; never invariant merely from candidacy.                                                  | Dynamic scripts/platforms may invalidate static candidates.                  |
| `playability.unintended-route-skip-candidate-count` / heuristic estimate | Non-adjacent candidate edges and checkpoint/stage topology.                                                                   | Integer; confidence follows edge model.                                                                                                                            | Advisory or [P] review gate. Confirmed progression-integrity violations require separate deterministic/runtime fact. | Advanced movement and scripts are not modeled in E1.                         |
| `playability.clearance-violation-count` / heuristic estimate             | Route surfaces, overhead geometry and avatar envelope.                                                                        | Integer; confidence from primitive support.                                                                                                                        | [P] acceptance threshold; exact collision overlap may support a future invariant.                                    | Rotated/animated geometry is conservative.                                   |

An approved future proof standard must specify controller space, engine/profile scope, analytic or
exhaustive method, tolerances and independent validation before emitting an `impossible` invariant.

## Checkpoint and hazard metrics

| ID / result kind                                           | Inputs and calculation                                                                          | Range and confidence                                                                                                   | Decision behavior                                                                                                              | Limitations                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `checkpoint.isolation` / deterministic fact                | Valid runtime checkpoint/respawn observations partitioned by player slot, scene and generation. | Ratio `[0,1]`; confidence `1` only with valid observations. Zero opportunities produce `missing-evidence`, never pass. | [I] any confirmed cross-player/cross-scene leakage blocks.                                                                     | Static analysis cannot establish runtime isolation.                |
| `checkpoint.order-correctness` / deterministic fact        | Checkpoint behavior order and route entries.                                                    | Boolean; confidence `1`.                                                                                               | [I] false blocks declared progression integrity.                                                                               | Does not prove touch/respawn runtime behavior.                     |
| `checkpoint.respawn-geometry-safety` / heuristic estimate  | Placement transform, clearance, hazard overlap and next-route geometry.                         | State plus coverage-derived confidence.                                                                                | [P] conservative acceptance gate. A deterministic intersection with required gameplay collision may emit a separate invariant. | Moving hazards require runtime evidence.                           |
| `hazard.safe-margin` / heuristic estimate                  | Distance from safe landing/walk regions to hazard volumes.                                      | Studs plus coverage-derived confidence.                                                                                | [P]/[C] device/avatar thresholds.                                                                                              | Does not include latency or dynamic hazards.                       |
| `hazard.fairness.geometry-estimate` / heuristic estimate   | Safe margin, exposure estimate, recovery/checkpoint distance and route context.                 | `[0,100]`; confidence from component coverage.                                                                         | [C] advisory only.                                                                                                             | “Fairness” is skill- and intent-dependent.                         |
| `hazard.visibility.geometry-estimate` / heuristic estimate | Camera projection, occlusion and deterministic color/region facts.                              | `[0,100]`; confidence from valid-view coverage.                                                                        | [C] advisory only.                                                                                                             | View/lighting dependent.                                           |
| `hazard.visibility.learned-estimate` / learned estimate    | Future validated visual model inputs.                                                           | Model-defined calibrated estimate.                                                                                     | [C] advisory only; never invariant.                                                                                            | Domain/model bias and screenshot protocol dependence.              |
| `hazard.visibility.composite` / derived composite          | Separate geometry and learned component metric IDs.                                             | `[0,100]`; calibrated fusion and propagated uncertainty.                                                               | [C] advisory only.                                                                                                             | Unavailable until fusion passes preregistered held-out evaluation. |

## Readability and onboarding metrics

| ID / result kind                                                                       | Inputs and calculation                                                                     | Range and confidence                            | Decision behavior                                    | Limitations                                                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `readability.route-contrast.geometry-estimate` / heuristic estimate                    | Projected route/non-route regions and deterministic rendered color facts.                  | `[0,100]`; view-coverage confidence.            | [C] advisory.                                        | Contrast is not equivalent to route clarity; needs accessibility profiles. |
| `readability.route-contrast.learned-estimate` / learned estimate                       | Future model component.                                                                    | Calibrated model output.                        | [C] advisory.                                        | Never ground truth.                                                        |
| `readability.first-object-visibility` / heuristic estimate                             | Spawn view, geometry-projected first route region, occlusion and projected area.           | `[0,100]`; protocol/coverage confidence.        | [P] onboarding review threshold; not invariant.      | Fixed camera approximates a first frame.                                   |
| `readability.goal-visibility` / heuristic estimate                                     | Finish-approach/overview regions and context.                                              | `[0,100]` or not-applicable.                    | [C] advisory.                                        | Some designs intentionally reveal goals late.                              |
| `readability.estimated-mobile-readability` / derived composite                         | Separate projected-size, contrast, clutter, safe-area and future human/learned components. | `[0,100]`; parent completeness and uncertainty. | [C] advisory, never a substitute for mobile testing. | Protocol/device/accessibility dependent.                                   |
| `onboarding.time-to-first-interaction.geometry-estimate` / heuristic estimate          | Route distance/controller profile estimate.                                                | Milliseconds; coverage-derived confidence.      | [C] target-band advisory.                            | Faster is not monotonically better.                                        |
| `onboarding.time-to-first-interaction.analytics-estimate` / analytics-derived estimate | Future first-party cohort aggregate.                                                       | Distribution/interval and sample metadata.      | [C] advisory; never automatic generation control.    | Correlational unless experiment-backed.                                    |
| `onboarding.time-to-first-reward.geometry-estimate` / heuristic estimate               | Estimated path to explicitly configured first reward.                                      | Milliseconds or missing-evidence.               | [C] advisory.                                        | Requires explicit reward semantics.                                        |
| `onboarding.objective-communication.composite` / derived composite                     | Geometry, learned and human component metric IDs, kept separately visible.                 | `[0,100]`; fusion uncertainty.                  | [C] advisory.                                        | Subjective, cultural and device dependent.                                 |

## Composition and style metrics

| ID / result kind                                                     | Inputs and calculation                                        | Range and confidence                                                | Decision behavior                                                           | Limitations                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `composition.visual-clutter.geometry-estimate` / heuristic estimate  | Edge/object/projected-overlap facts across valid views.       | `[0,100]`; coverage-derived confidence.                             | [C] advisory.                                                               | Texture/style can raise edge density without harming navigation. |
| `composition.visual-clutter.learned-estimate` / learned estimate     | Future model component.                                       | Calibrated estimate.                                                | [C] advisory.                                                               | Model/style bias.                                                |
| `composition.focal-hierarchy.geometry-estimate` / heuristic estimate | Region saliency facts and route/goal/hazard dominance.        | `[0,100]`; protocol/model coverage.                                 | [C] advisory.                                                               | Saliency is not human-attention proof.                           |
| `composition.object-density` / deterministic fact                    | Gameplay/decorative counts per world volume and route length. | Counts/ratios; confidence `1` with complete manifest.               | No visual severity by itself; budget rules consume the fact separately.     | Density is not quality or clutter.                               |
| `style.color-role-manifest-consistency` / deterministic fact         | Manifest semantic role/color assignments.                     | Ratio; confidence `1`. Zero applicable objects is `not-applicable`. | [P] profile acceptance/advisory threshold, non-invariant.                   | Does not represent rendered lighting.                            |
| `style.palette-consistency.geometry-estimate` / heuristic estimate   | Versioned palette extraction across valid views.              | `[0,100]`; valid-view confidence.                                   | [C] advisory.                                                               | Consistency is not beauty; contrast can be intentional.          |
| `style.visual-style-consistency.learned-estimate` / learned estimate | Future multi-view model component.                            | Calibrated estimate and OOD status.                                 | [C] advisory.                                                               | Novel styles may be out of domain.                               |
| `composition.reference-distance.learned-estimate` / learned estimate | Compatible ReferenceProfile feature distributions.            | Distance/percentile and reference coverage.                         | Informational only; excluded from automatic generation and invariant logic. | Similarity is neither quality nor permission to imitate.         |

## Performance, difficulty and policy metrics

| ID / result kind                                                | Inputs and calculation                                                                                        | Range and confidence                                           | Decision behavior                                                     | Limitations                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `policy.decorative-collision-violations` / deterministic fact   | Manifest decorative collision/touch behavior and compatible built observations.                               | Integer; confidence `1` for validated scope.                   | [I] `>0` blocks when decoration affects gameplay.                     | Future validated gameplay assets require a distinct gameplay role. |
| `performance.part-count` / deterministic fact                   | Complete manifest/built inventory by role/class.                                                              | Integer; confidence `1`.                                       | [P] profile budgets may block publication; not a universal invariant. | One performance driver among many.                                 |
| `performance.triangle-count` / deterministic fact               | Audited mesh metadata; unknown assets remain missing.                                                         | Integer plus unknown count.                                    | [P] device/profile budget or incomplete result.                       | Native Part render cost varies by engine.                          |
| `performance.material-count` / deterministic fact               | Distinct material/texture variants from complete metadata.                                                    | Integer.                                                       | [P] device/profile budget.                                            | Does not directly equal draw calls.                                |
| `performance.frame-risk.geometry-estimate` / heuristic estimate | Static counts and complexity components.                                                                      | `low`, `medium`, `high`, `critical`; confidence from coverage. | [C] advisory/[P] conservative acceptance only.                        | Device/engine dependent.                                           |
| `performance.frame-runtime-fact` / deterministic fact           | Runtime frame/physics distributions for a recorded device/render profile.                                     | Distribution and sample completeness.                          | [P]/[C] profile targets; no universal device claim.                   | Workload and capture conditions matter.                            |
| `difficulty.smoothness.geometry-estimate` / heuristic estimate  | Transition difficulty vector relative to a declared curve.                                                    | `[0,100]`; component confidence.                               | [C] advisory.                                                         | Skill/mechanic dependent.                                          |
| `retention.readiness.composite` / derived composite             | Separate onboarding, reward, difficulty, readability, performance and approved analytics/human component IDs. | `[0,100]` only after calibration; otherwise unavailable.       | [C] advisory, excluded from E1 and automatic generation.              | Correlational readiness, never guaranteed retention.               |

## Severity and gate semantics

- **Info:** descriptive fact or opportunity.
- **Warning:** advisory/profile target miss.
- **Error:** strong defect or conservative profile failure requiring review.
- **Blocking invariant:** non-overridable integrity/safety failure.
- **Blocking profile gate:** model-relative publication decision for one named profile.

Reports show invariant and profile blocking separately. Learned, subjective, analytics-derived and
derived-composite metrics never independently create invariant blockers.

## Score profiles

### E1 rule-based profile

E1 exposes:

- invariant status;
- model-relative coarse transition states;
- playability/checkpoint/hazard/policy/performance category facts and estimates;
- evidence completeness and per-metric confidence;
- no overall aggregate score.

Visual, style, onboarding-human, reference and retention categories are `unavailable`, not
renormalized. An E1 report is not aggregate-comparable with a future fully evidenced report.

### Future experimental full profile

The following weights are [P] examples for research planning only and are not approved constants:

| Category            | [P] example weight |
| ------------------- | -----------------: |
| Playability         |                25% |
| Route readability   |                12% |
| Checkpoint quality  |                 8% |
| Hazard fairness     |                 8% |
| Composition         |                 8% |
| Style consistency   |                 7% |
| Performance         |                10% |
| Difficulty curve    |                 8% |
| Onboarding          |                 7% |
| Retention readiness |                 7% |

No aggregate is published until weights, coverage, confidence propagation, normalization and
failure criteria pass preregistered held-out calibration. Retention readiness may remain excluded
even after other categories are calibrated.

## Confidence and completeness

Confidence is never a hand-authored number without a versioned calculation. Each method defines:

- exact input coverage and missingness;
- approximation/model coverage;
- sample size/effective sample size where applicable;
- protocol/environment compatibility;
- calibration/OOD status;
- propagation from parent metrics.

Any completeness multiplier, confidence weight or minimum coverage is [C] until validated.
Missing evidence is never replaced by `0` or `100`. Required missing evidence yields `incomplete`;
optional missing evidence leaves the metric/category unavailable. Profiles cannot silently
renormalize missing categories.

## Outcome behavior

- [I] invalid contracts, hashes, catalog/profile identities or required evidence reject or
  invalidate evaluation; no trusted approval/aggregate is emitted.
- [I] incomplete required-route topology, unreachable finish topology, confirmed checkpoint leakage
  or decorative gameplay collision produce `fail`.
- [P] a conservative E1 publication profile may produce `fail-under-profile` for
  `infeasible-under-model`; it must not claim impossibility.
- [C] visual, preference and retention results remain advisory.

Earlier numeric caps such as `20` or `35` are removed rather than presented as validated. A failed
invariant cannot be made acceptable by an aggregate regardless of its numeric value.

## Comparison compatibility

Direct category or aggregate comparison requires identical/compatible:

- MetricCatalog and ScoringProfile content hashes;
- evaluator/calculation-bundle schema;
- required metric set and evidence capability/coverage class;
- avatar/device/controller and screenshot environment classes;
- reference/calibration snapshots for affected metrics.

Different profiles are compared only on shared component metrics whose MetricDefinitions and
evidence classes match. E1 and a future full profile are never compared through renormalized overall
scores. The result is `incomparable` when a documented adapter cannot justify the difference.

Variant reports include raw deltas, confidence/coverage, invariant/profile gate changes, missing
evidence and Pareto improvements/regressions. Popularity, learned preference or retention
correlation can never decide a winner by itself.
