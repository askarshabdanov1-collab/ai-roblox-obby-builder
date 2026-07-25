# Roblox Obby Evaluator — Phase E0 design

## Status and scope

Phase E0 is a design-only phase for an explainable evaluator that can later support the Windows
desktop AI Roblox Obby Builder. It introduces no evaluator production code, schemas, external model
dependencies, Studio plugin, MCP server, scraping, training, analytics collection, or desktop
application.

The evaluator is intended to assess:

- physical playability, safe-route reachability, jump/drop feasibility, checkpoints, hazards,
  finish reachability, softlocks, and unintended route skips;
- mobile readability, route clarity, visual composition, style and palette consistency, hierarchy,
  and object density;
- performance budgets, difficulty progression, onboarding clarity, and retention readiness.

The design deliberately uses the term **assessment**, not proof of objective beauty or guaranteed
retention. Popularity indicators are contextual metadata, never ground-truth quality labels.

## Design principles

1. **Playability gates presentation.** An impossible required route is blocking and caps aggregate
   scores regardless of visual quality.
2. **Facts, estimates, and judgments stay distinct.** Reports never disguise heuristic, learned,
   subjective, or analytics-derived values as deterministic facts.
3. **Every result is evidence-linked.** Metrics and findings identify the objects, transitions,
   coordinates, screenshots, regions, logs, samples, versions, and configuration that produced
   them.
4. **Reproduction precedes optimization.** An evaluation is immutable once finalized and can be
   replayed from pinned inputs.
5. **Generated input is untrusted.** Contracts, hashes, bounds, and version compatibility are
   checked before Studio or evaluator state changes.
6. **Native Parts own gameplay.** Decoration, including future AI-generated meshes, remains
   non-colliding unless separately validated through a future gameplay-asset process.
7. **Missing evidence lowers confidence.** It never silently becomes a pass.
8. **Human approval controls corrections.** Suggestions are proposed as patches and are not applied
   to a scene without an explicit, scoped approval.
9. **Reference use is comparative, not imitative.** The system must not copy maps, assets, branding,
   characters, or layouts.
10. **Phase 0 contracts remain stable.** E0 proposes evaluator-owned contracts that reference
    PlaceSpec and SceneManifest; it does not change either Phase 0 contract.

## Document map

- [Architecture and trust boundaries](architecture.md)
- [Evaluation contracts](contracts.md)
- [Metric taxonomy and scoring](metrics-and-scoring.md)
- [Evidence, Studio integration, and screenshots](evidence-and-studio.md)
- [Visual evaluation, reference data, human labels, and analytics](visual-data-and-feedback.md)
- [MCP, local API, and repository structure](api-and-repository.md)
- [Phase E1 rule-based implementation plan](phase-e1-plan.md)

## Phase boundaries

| Phase                         | Deliverable                                                                                                                   | Explicitly excluded                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| E0                            | Reviewed architecture, contracts, metric/scoring definitions, evidence protocol, integrations design, governance, and E1 plan | Production schemas/code, models, Studio bridge, data collection, training     |
| E1                            | Deterministic rule-based evaluator and reproducible reports                                                                   | Visual models, external datasets, analytics calibration, automatic correction |
| Future runtime evidence phase | Authenticated Studio evidence collector and deterministic screenshot capture                                                  | Learned scoring unless separately approved                                    |
| Future visual phase           | Audited, pinned visual workers and calibrated weak-signal fusion                                                              | A single “beauty” ground truth                                                |
| Future calibration phase      | Consented human preferences and first-party analytics calibration                                                             | Private competitor analytics or causal retention claims                       |

## Phase E0 decisions

- The evaluator produces a **score profile plus blocking findings**, never only one overall number.
- Deterministic geometry analysis runs before Studio or visual work and can stop an evaluation.
- Evidence is content-addressed and immutable; reports reference evidence instead of embedding
  mutable external state.
- A local orchestrator coordinates capability-specific workers through versioned contracts.
- Studio integration is future work and uses an authenticated localhost bridge with scene hashes,
  generation tokens, cancellation, and timeouts.
- Learned and analytics-derived signals cannot clear deterministic failures.
- Pairwise variant comparison uses shared plans and evidence completeness checks, not raw score
  subtraction across incompatible runs.

## Unresolved decisions

These require prototypes or policy review and are intentionally not settled in E0:

- exact Roblox avatar rigs, controller parameters, and physics tolerances for “exact” jump
  simulation;
- whether runtime automation should use a Studio plugin, an MCP bridge hosted by Studio, or both;
- screenshot storage retention, encryption, and workspace quota defaults;
- legal review and permitted transformations for each public reference source;
- the specific visual model set, licenses, hardware requirements, and whether workers remain local;
- score weights and blocking thresholds after E1 fixture calibration;
- minimum sample sizes and privacy thresholds for first-party analytics calibration;
- rater recruitment, age policy, compensation, and jurisdiction-specific consent requirements;
- the approved desktop transport and packaging technology;
- whether approved correction patches require a new evaluator-owned patch contract.
