# Metric taxonomy and scoring model

## Metric definition requirements

Every catalog entry is versioned and defines:

- stable ID, name, category, source kind, required evidence, and calculation;
- raw type/unit/range and normalization curve, if scored;
- confidence calculation and limitations;
- severity thresholds and a profile-overridable blocking threshold;
- applicability and missing-evidence behavior;
- evidence subject granularity;
- catalog tests and calibration status.

Source kinds:

- **D** — deterministic fact/rule;
- **H** — heuristic estimate from deterministic or runtime facts;
- **L** — learned visual/preference estimate;
- **A** — first-party analytics-derived estimate;
- **S** — human subjective judgment.

E0 defines the initial taxonomy; E1 implements only D/H metrics that do not require Studio, models,
datasets, labels, or analytics. Thresholds marked “calibrate” are design defaults that require E1
fixture review before release.

## Playability and route metrics

| ID / name                                                               | Inputs and calculation                                                                                                                                       | Range; confidence                                                                                           | Severity and blocking                                                                                           | Limits; kind                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `playability.route-completeness` — Route completeness                   | Manifest route IDs, gameplay objects, route graph. Ratio of declared consecutive transitions with resolvable safe endpoints and a path from spawn to finish. | `[0,1]`; `1.0` confidence after valid manifest and exact graph build.                                       | Warning `<1`; **blocking `<1`**.                                                                                | Declared-route completeness is not exact physics feasibility. **D**                                                     |
| `playability.impossible-transition-count` — Impossible transition count | Canonical surfaces, avatar profile, transition list. Count transitions exceeding the selected rise/drop/gap model or lacking a landing region.               | Integer `0..routeTransitions`; D coarse mode confidence `0.75`, exact runtime mode based on trial coverage. | Error `>0`; **blocking `>0` on required route**.                                                                | Coarse model approximates rotation, wedges, momentum, and controls. **H** in E1; future runtime may strengthen evidence |
| `playability.excessive-drop-count` — Excessive drop count               | Surface heights and avatar profile. Count required transitions beyond configured safe downward drop.                                                         | Integer `0..routeTransitions`; `0.9` if axis-aligned, reduced for approximated surfaces.                    | Warning on optional path; **blocking `>0` when landing is lethal/unreachable on required route**.               | A large drop may be intentionally safe with runtime mechanics not represented. **H**                                    |
| `playability.finish-reachability` — Finish reachability                 | Spawn, safe-route graph, transition feasibility, finish ID. Boolean plus reachable-path count.                                                               | Boolean/count; minimum confidence of component edges.                                                       | **Blocking when false or finish unresolved**.                                                                   | Does not prove a human can execute the path. **H**                                                                      |
| `playability.softlock-candidate-count` — Softlock candidates            | Conservative spatial graph, reset/kill/finish/checkpoint access. Count reachable regions with no safe exit and no defined recovery.                          | Integer `0..regions`; confidence `0.6–0.9` by geometry coverage.                                            | Warning `>0`; blocking only when candidate lies on required route and recovery is absent with high confidence.  | Dynamic platforms/scripts can invalidate static results. **H**                                                          |
| `playability.unintended-route-skip-count` — Unintended route skips      | Non-adjacent safe-route pairs, surface gaps/rises, checkpoint sequence. Count feasible edges that bypass required checkpoints/stages.                        | Integer; confidence follows feasibility model.                                                              | Warning `>0`; error if finish/checkpoint progression can be bypassed; blocking if progression integrity breaks. | Does not model advanced movement exploits until runtime mode exists. **H**                                              |
| `playability.clearance-violation-count` — Avatar clearance violations   | Landing/walk surfaces, overhead geometry, avatar envelope. Count route regions below minimum clearance.                                                      | Integer; `0.8–1.0` depending on primitive support.                                                          | Error `>0`; blocking when all required paths are obstructed.                                                    | Rotated/animated geometry is conservative. **H**                                                                        |

## Checkpoint and hazard metrics

| ID / name                                                     | Inputs and calculation                                                                                                                                                                                         | Range; confidence                                                                      | Severity and blocking                                                                                          | Limits; kind                                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `checkpoint.isolation` — Checkpoint isolation                 | Runtime observations per player/session plus manifestHash/generation. Ratio of checkpoint/respawn state transitions scoped to the correct player and scene. Static mode verifies architecture invariants only. | `[0,1]`; `1.0` only with complete deterministic unit and multiplayer runtime evidence. | Error `<1`; **blocking on any confirmed cross-player or cross-scene leak**.                                    | Static analysis cannot prove engine event isolation. **D** for observed event matching        |
| `checkpoint.order-correctness` — Checkpoint order correctness | Checkpoint behavior orders, safe-route positions, route entries. Verify unique contiguous order and monotonic route order.                                                                                     | Boolean; confidence `1.0`.                                                             | **Blocking when false**.                                                                                       | Does not prove every checkpoint touch volume is practically reachable. **D**                  |
| `checkpoint.respawn-safety` — Respawn safety                  | Checkpoint surface, root placement, nearby hazards/clearance, next route target. Verify non-intersection, safe stand region, deterministic facing.                                                             | `[0,1]` coverage; `0.8–1.0`.                                                           | Error on unsafe checkpoint; **blocking if required respawn intersects collision/hazard or immediately kills**. | Moving hazards require runtime evidence. **H**                                                |
| `hazard.fairness` — Hazard fairness                           | Hazard distance to safe route/landing, exposure time estimate, recovery/checkpoint distance, runtime deaths. Rule-based subscore.                                                                              | `[0,100]`; confidence `0.5–0.85`.                                                      | Warning `<60`; error `<35`; never sole blocker unless a required transition is provably lethal.                | “Fair” depends on player skill and intent; report subcomponents. **H**, later A/S calibration |
| `hazard.visibility` — Hazard visibility                       | Fixed approach screenshots, geometry occlusion, color-role contrast, screen coverage. Weighted minimum across required approaches.                                                                             | `[0,100]`; confidence reflects capture validity and segmentation quality.              | Warning `<60`; error `<35`; no standalone blocking threshold.                                                  | Visibility is viewport, lighting, and model dependent. **H/L** future                         |
| `hazard.safe-margin` — Hazard safe margin                     | Minimum horizontal/vertical distance between safe landing/walk regions and hazard collision volumes.                                                                                                           | Studs `>=0`; confidence `0.8–1.0`.                                                     | Profile warning/error thresholds by avatar/device; blocking at overlap that makes required landing lethal.     | Does not include latency or moving hazards. **H**                                             |

## Route readability and onboarding metrics

| ID / name                                                                 | Inputs and calculation                                                                                                               | Range; confidence                                                                     | Severity and blocking                                                    | Limits; kind                                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `readability.route-contrast` — Route contrast                             | Route/non-route segmentation, luminance/chroma contrast, material/color roles across views. Robust percentile rather than best view. | `[0,100]`; confidence `0.4–0.85`.                                                     | Warning `<60`; error `<35`; non-blocking.                                | Contrast is not equivalent to clarity; color-vision profiles required. **H/L** future                  |
| `readability.first-object-visibility` — First-object visibility           | Spawn view, first route object region, occlusion and projected area. Visible ratio and angular displacement from camera forward.     | `[0,100]`; confidence `0.7–0.95` with deterministic segmentation/geometry projection. | Warning `<70`; error `<40`; score cap on onboarding, not global blocker. | Camera protocol approximates a player's first frame. **H** future screenshot/geometry                  |
| `readability.goal-visibility` — Goal visibility                           | Finish-approach and overview views, finish region, route context. Visibility/contrast score where design expects a visible goal.     | `[0,100]` or not-applicable; confidence `0.5–0.9`.                                    | Warning `<55`; non-blocking.                                             | Some obbies intentionally reveal goals late; applicability is plan/profile specific. **H/L** future    |
| `readability.estimated-mobile-readability` — Estimated mobile readability | Mobile screenshot, projected obstacle sizes, contrast, clutter, safe area, UI overlap. Minimum critical-object readability.          | `[0,100]`; confidence `0.4–0.8`.                                                      | Warning `<65`; error `<40`; performance/readability cap, not blocker.    | Not a substitute for mobile user testing or accessibility review. **H/L** future                       |
| `onboarding.time-to-first-interaction` — Time to first interaction        | Geometry path estimate or runtime time from character-ready to first required jump/touch.                                            | Milliseconds `>=0`; confidence by evidence source.                                    | Profile warning above target band; no universal blocking threshold.      | Faster is not always better; report target interval, not monotonic quality. **H**, later A             |
| `onboarding.time-to-first-reward` — Time to first reward                  | Runtime/geometry estimate to first checkpoint/reward event.                                                                          | Milliseconds `>=0` or missing; confidence by evidence.                                | Warning above profile band; no universal blocker.                        | Reward semantics must be explicitly configured; correlation is not retention causation. **H**, later A |
| `onboarding.objective-communication` — Objective communication            | First frame, first-route visibility, route contrast, human pairwise labels. Composite with source-separated components.              | `[0,100]`; confidence weighted by evidence completeness.                              | Warning `<60`; onboarding cap `<35`.                                     | Subjective and culturally/device dependent. **H/L/S** future                                           |

## Composition and style metrics

| ID / name                                                     | Inputs and calculation                                                                                                               | Range; confidence                                                                               | Severity and blocking                                                              | Limits; kind                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `composition.visual-clutter` — Visual clutter                 | Edge density, saliency dispersion, object overlap, projected density across protocol views. Report per-view and worst critical view. | `[0,100]`, where `100` is excessive clutter; confidence `0.4–0.85`.                             | Warning `>60`; error `>80`; non-blocking.                                          | Texture/style may raise edge density without harming navigation. **H/L** future      |
| `composition.focal-hierarchy` — Focal hierarchy               | Saliency concentration on route/goal/hazard regions and dominance ordering.                                                          | `[0,100]`; confidence `0.4–0.8`.                                                                | Warning `<55`; non-blocking.                                                       | Saliency models approximate attention and can be biased. **H/L** future              |
| `composition.object-density` — Object density                 | Count/occupied volume/projected overlaps per world volume and route length; separate gameplay/decorative.                            | Objects per `1,000 studs³`, objects per route stud, overlap ratio; confidence `1.0` for counts. | Profile warnings; error only for performance/budget breach; non-blocking visually. | Density alone is not clutter or quality. **D** facts, **H** interpretation           |
| `style.color-role-consistency` — Color-role consistency       | Manifest semantic color roles, palette clusters, screenshot samples. Rate objects/views matching profile role separation.            | `[0,100]`; confidence `0.7–1.0` for manifest, lower for rendered color.                         | Warning `<70`; non-blocking.                                                       | Lighting changes rendered color; creative exceptions may be valid. **D/H**           |
| `style.palette-consistency` — Palette consistency             | Dominant palette across views/regions, intra-scene distances, role-aware exceptions.                                                 | `[0,100]`; confidence `0.5–0.85`.                                                               | Warning `<60`; non-blocking.                                                       | Consistency is not beauty; intentional contrast must remain possible. **H/L** future |
| `style.visual-style-consistency` — Style consistency          | Multi-view features for shape/material/texture/lighting coherence; compare within scene before references.                           | `[0,100]`; confidence `0.3–0.8`.                                                                | Warning `<55`; non-blocking.                                                       | Model/style bias and novel styles limit interpretation. **L/H** future               |
| `composition.reference-distance` — Curated reference distance | Distance to compatible ReferenceProfile feature distributions, stratified by genre/view/style.                                       | Non-negative distance plus percentile; confidence by reference coverage.                        | Informational only; never blocking.                                                | Similarity is neither quality nor permission to imitate. **L** future                |

## Performance, difficulty, and policy metrics

| ID / name                                                                  | Inputs and calculation                                                                                                                        | Range; confidence                                                                 | Severity and blocking                                                                                | Limits; kind                                                                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `policy.decorative-collision-violations` — Decorative collision violations | Manifest decorative physics and built-instance observations. Count decoration with collision/touch gameplay behavior.                         | Integer `>=0`; confidence `1.0` manifest, runtime confidence by coverage.         | **Blocking `>0`**.                                                                                   | Future validated gameplay assets must use a separate role, not waive this rule. **D**                    |
| `performance.part-count` — Part count                                      | Manifest/built instance classes, separated by gameplay/decorative/dynamic.                                                                    | Integer `>=0`; confidence `1.0`.                                                  | Warning/error/blocking at device/profile budgets.                                                    | Part count is only one performance driver. **D**                                                         |
| `performance.triangle-count` — Triangle count                              | Audited mesh metadata plus native primitive policy; unknown mesh counts remain missing.                                                       | Integer `>=0` plus unknown count; confidence `1.0` for audited metadata.          | Warning/error at budgets; blocking when required limit is exceeded or unknown meshes violate policy. | Native Parts do not map to a fixed rendered triangle cost across engine versions. **D** metadata         |
| `performance.material-count` — Material count                              | Distinct material variants/textures used by rendered instances.                                                                               | Integer `>=0`; confidence `1.0` from complete scene metadata.                     | Warning/error at profile budgets; non-blocking unless hard platform budget.                          | Does not directly equal draw calls. **D**                                                                |
| `performance.estimated-frame-risk-class` — Estimated frame-risk class      | Static counts, transparency/lights/particles/collision complexity; later runtime frame distributions.                                         | `low`, `medium`, `high`, `critical`; confidence `0.4–0.9`.                        | Warning medium, error high, profile blocker critical.                                                | Static estimates are device/engine dependent; must expose contributing facts. **H**, later runtime facts |
| `difficulty.smoothness` — Difficulty smoothness                            | Transition difficulty vector from gap/rise/drop/landing margin/hazards. Penalize unplanned spikes and regressions relative to declared curve. | `[0,100]`; confidence follows transition model.                                   | Warning `<60`; error `<35`; non-blocking unless spike is impossible.                                 | Difficulty is skill-dependent and mechanics may be unmodeled. **H**                                      |
| `retention.readiness` — Retention readiness profile                        | Onboarding, reward/checkpoint pacing, difficulty, readability, performance, first-party calibration when available.                           | `[0,100]` plus component vector; confidence capped by weakest required component. | Advisory; never blocking and never a retention guarantee.                                            | Correlational readiness only; no competitor/private analytics. **H**, later A/S/L                        |

## Severity semantics

- **Info:** descriptive fact or improvement opportunity without a failed target.
- **Warning:** likely degradation or profile miss; scene can remain evaluable.
- **Error:** strong defect requiring review; may cap related categories.
- **Blocking:** deterministic or sufficiently evidenced violation that invalidates the selected
  evaluation profile, such as an impossible required route or decorative collision.

Learned, subjective, and analytics-derived metrics cannot independently create a blocking finding.

## Score profile

The report exposes the following category scores independently:

| Category            | Default design weight | Preconditions                                 |
| ------------------- | --------------------: | --------------------------------------------- |
| Playability         |                   25% | No blocking route/finish failure              |
| Route readability   |                   12% | Required views/evidence or marked unavailable |
| Checkpoint quality  |                    8% | Checkpoint metrics applicable                 |
| Hazard fairness     |                    8% | Hazard metrics applicable                     |
| Composition         |                    8% | Valid screenshot protocol                     |
| Style consistency   |                    7% | Valid screenshot/manifest evidence            |
| Performance         |                   10% | Static inventory; runtime raises confidence   |
| Difficulty curve    |                    8% | Transition estimates available                |
| Onboarding          |                    7% | Spawn/first-route evidence                    |
| Retention readiness |                    7% | Component profile; advisory                   |

Weights are proposed defaults, not E0-calibrated constants. Category scores are always shown even
when a profile permits a weighted aggregate.

Confidence is a separate profile dimension, never blended into “quality” invisibly:

```text
categoryConfidence =
  completenessFactor
  × weightedGeometricMean(metricConfidence)
  × versionCompatibilityFactor

reportedAggregate =
  cappedWeightedCategoryScore

decisionConfidence =
  minimum(requiredCategoryConfidence, evidenceCoverage)
```

The report presents both `reportedAggregate` and `decisionConfidence`.

## Blocking failures and score caps

Default hard gates:

- invalid SceneManifest/hash or unsupported evaluator contract: reject run, no score;
- route completeness below `1`: overall score capped at `20`;
- impossible required transition or unreachable finish: overall score capped at `20` and outcome
  `fail`;
- checkpoint order/state leak or unsafe required respawn: overall score capped at `35`;
- decorative collision violation: overall score capped at `35`;
- confirmed required-route softlock: overall score capped at `20`;
- missing mandatory deterministic evidence: outcome `incomplete`, no aggregate;
- missing optional visual/runtime evidence: affected categories unavailable; aggregate is either
  omitted or renormalized only when the profile explicitly permits it and is labeled partial.

Caps apply after weighting: `finalAggregate = min(weightedAggregate, activeCaps...)`. Attractive
visual scores can never lift a scene above a playability cap.

## Weighted score behavior

1. Normalize each available metric using its versioned monotonic or target-band curve.
2. Apply metric weights within its category.
3. Do not substitute `0` or `100` for missing evidence.
4. If a required metric is missing, category is unavailable and profile rules determine whether the
   report is incomplete.
5. If optional metrics are missing, renormalize within the category only when at least the
   profile-defined coverage is present.
6. Calculate category scores, then the optional aggregate.
7. Apply blocking outcomes and caps.
8. Report raw values, normalized values, weights, confidence, coverage, and caps.

## Comparison between scene variants

`compare_scene_variants` may compare variants only when:

- plans, score profile versions, metric catalog versions, avatar/device profiles, and required
  capabilities match;
- each variant has equivalent required view types and evidence completeness;
- all runs use compatible evaluator/Studio/model/reference/calibration versions;
- variants are evaluated independently before pairwise deltas are calculated.

The comparison reports:

- raw and normalized per-metric deltas;
- category deltas and confidence intervals/bands;
- blocking finding changes;
- evidence coverage differences;
- Pareto improvements/regressions rather than only a winner;
- human pairwise labels separately from automated scores;
- “incomparable” where protocol or evidence mismatches would mislead.

No popularity indicator, learned reward score, or retention correlation can decide a winner by
itself.
