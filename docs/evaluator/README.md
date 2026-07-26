# Roblox Obby Evaluator

## Status and scope

Phase E0 remains the authoritative reviewed design history. Phase E1a implements versioned
contracts, canonical identities, E1 catalog/profile fixtures, and deterministic native-Part
geometry/transition inputs. Phase E1b adds declared route topology and model-relative coarse
playability evidence. See the [E1a completion record](phase-e1a-completion.md) and
[E1b implementation record](phase-e1b-implementation.md). There is still no scoring/report
workflow, CLI, external model dependency, Studio plugin, MCP server, scraping, training, analytics
collection, or desktop application.
The aggregate configuration-graph validator is the sole public request/plan binding boundary.

The evaluator is intended to assess:

- physical playability, safe-route reachability, jump/drop feasibility, checkpoints, hazards,
  finish reachability, softlocks, and unintended route skips;
- mobile readability, route clarity, visual composition, style and palette consistency, hierarchy,
  and object density;
- performance budgets, difficulty progression, onboarding clarity, and retention readiness.

The design deliberately uses the term **assessment**, not proof of objective beauty or guaranteed
retention. Popularity indicators are contextual metadata, never ground-truth quality labels.

## Design principles

1. **Invariant integrity gates presentation.** Required-route/finish topology failures and other
   catalog invariants block independently of profile thresholds or visual quality. Coarse geometry
   may only report model-relative infeasibility.
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
- [Phase E1a implementation completion record](phase-e1a-completion.md)
- [Phase E1b implementation record](phase-e1b-implementation.md)
- [Independent-audit remediation matrix](audit-remediation.md)

## Phase boundaries

| Phase                         | Deliverable                                                                                                                   | Explicitly excluded                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| E0                            | Reviewed architecture, contracts, metric/scoring definitions, evidence protocol, integrations design, governance, and E1 plan | Production schemas/code, models, Studio bridge, data collection, training |
| E1a                           | Evaluator contracts, content hashes, metric catalog/profile, fixtures, and geometry primitives                                | Route verdict engine, scoring workflow, CLI, integrations                 |
| E1b                           | Safe-route topology and coarse playability evidence                                                                           | Aggregate/category workflow, public CLI, runtime evidence                 |
| E1c                           | Invariant gates, E1 category results, reports, CLI, and end-to-end fixtures                                                   | Visual models, external datasets, Studio, analytics, corrections          |
| Studio feasibility milestone  | Permissions/transport/lifecycle prototype before automation                                                                   | Assumed multiplayer reliability or production plugin                      |
| Future runtime evidence phase | Authenticated Studio evidence collector and deterministic screenshot capture                                                  | Learned scoring unless separately approved                                |
| Future visual phase           | Audited, pinned visual workers and calibrated weak-signal fusion                                                              | A single “beauty” ground truth                                            |
| Future calibration phase      | Consented human preferences and first-party analytics calibration                                                             | Private competitor analytics or causal retention claims                   |

## Phase E0 decisions

- E1 produces category results, evidence completeness, confidence, and separately reported
  invariant/profile blockers; it has no aggregate score.
- MetricDefinition, MetricCatalog, and ScoringProfile are content-addressed. A profile may change
  invariant display severity, but never blocking status or outcome effect.
- Deterministic geometry analysis runs before Studio or visual work and can stop an evaluation.
- Evidence and finalized report payloads are content-addressed and immutable. Deletion uses an
  immutable `AvailabilityRecord` identified by `availabilityRecordHash`, or a newly hashed derived
  report.
- A local orchestrator coordinates capability-specific workers through versioned contracts.
- Studio integration is future work and uses an authenticated localhost bridge with scene hashes,
  generation tokens, cancellation, and timeouts.
- Learned and analytics-derived signals cannot clear deterministic failures.
- Pairwise variant comparison uses shared plans and evidence completeness checks, not raw score
  subtraction across incompatible runs.

## Unresolved decisions

These require prototypes or policy review and are intentionally not settled in E0:

- the future approved proof standard, controller/avatar profiles, engine scope, and tolerances
  needed before any transition may be called impossible;
- which transport passes the Studio feasibility milestone; reliable automated multiplayer control
  is explicitly unproven;
- screenshot storage retention, encryption, and workspace quota defaults;
- legal review and permitted transformations for each public reference source;
- the specific visual model set, licenses, hardware requirements, and whether workers remain local;
- score weights and blocking thresholds after E1 fixture calibration;
- minimum sample sizes and privacy thresholds for first-party analytics calibration;
- rater recruitment, age policy, compensation, and jurisdiction-specific consent requirements;
- the approved desktop transport and packaging technology;
- whether approved correction patches require a new evaluator-owned patch contract.

## Documentation validation

E0 deliberately adds no Markdown/Mermaid dependency. Current validation uses Prettier, the
repository aggregate validation, a repository-local relative-link existence check, and manual
review of Mermaid blocks:

```text
npx prettier --check README.md "docs/**/*.md"
npm run validate
```

A future phase may add a small pinned link/Mermaid checker only when CI rendering proves a need and
the dependency passes license/security review. External link availability is not a deterministic
build gate.
