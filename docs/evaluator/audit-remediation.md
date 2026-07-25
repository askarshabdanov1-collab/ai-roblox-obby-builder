# Phase E0 independent-audit remediation

This matrix records the required design corrections applied to PR #2. It is documentation, not an
implementation claim.

| Audit issue                           | Correction and source of truth                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Overridable safety/integrity gates | [Architecture](architecture.md), [contracts](contracts.md), [metrics/scoring](metrics-and-scoring.md), [API](api-and-repository.md), and [E1 plan](phase-e1-plan.md) separate immutable invariants, profile acceptance gates, and advisory thresholds. Display severity may change; invariant blocking cannot.                                                                                |
| 2. Coarse infeasibility overclaimed   | [Metrics](metrics-and-scoring.md) and [E1 plan](phase-e1-plan.md) use the three model-relative states and `coarse-infeasible-transition-count`; [architecture](architecture.md) preserves separate empirical runtime evidence and conflicts.                                                                                                                                                  |
| 3. Mixed metric source contracts      | [Contracts](contracts.md) define six discriminated result variants plus content-addressed MetricDefinition, MetricCatalog, and ScoringProfile; [metrics](metrics-and-scoring.md) assigns one source per component and explicit derived fusion.                                                                                                                                                |
| 4. Hash-domain ambiguity              | [Contracts](contracts.md#hash-and-reproducibility-domains) define versioned canonicalization, non-self-referential named preimages, exact field/order/time/execution/environment rules, fixed evidence-kind identities, configuration hashes, and reproducibility examples. [Evidence governance](evidence-and-studio.md#evidence-storage) uses the same content-versus-envelope terminology. |
| 5. Uncalibrated scoring constants     | [Metrics](metrics-and-scoring.md) classify constants [I]/[P]/[C], remove E1 caps/aggregate, prohibit missing-category renormalization, and define profile compatibility.                                                                                                                                                                                                                      |
| 6. Incomplete Studio feasibility      | [Evidence/Studio](evidence-and-studio.md) adds permissions/settings, capability/version negotiation, transport detection/rejection, leases/heartbeats, crash/orphan/startup recovery, pre-run state, stale cleanup, manual fallback, and a feasibility milestone. Multiplayer remains unproven.                                                                                               |
| 7. Premature screenshot v1            | [Evidence/Studio](evidence-and-studio.md) renames it `roblox-obby-fixed-views-draft-0`, enumerates requested/observed parameters, metadata, and incompatibility-by-default.                                                                                                                                                                                                                   |
| 8. Deletion contradicted immutability | [Contracts](contracts.md), [evidence governance](evidence-and-studio.md), [dataset governance](visual-data-and-feedback.md), and [API](api-and-repository.md) use availability overlays or newly hashed derived reports and preserve original hashes.                                                                                                                                         |
| 9. Oversized E1                       | [E1 plan](phase-e1-plan.md) defines E1a/E1b/E1c with branch, scope, exclusions, acceptance, tests, commands, rollback boundary, stop conditions, and expected size.                                                                                                                                                                                                                           |
| 10. Command ownership ambiguity       | [E1 plan](phase-e1-plan.md) assigns every existing/proposed command to one phase and separates evaluator contract generation from existing Phase 0 generation.                                                                                                                                                                                                                                |
| 11. Missing provenance flows          | [Architecture](architecture.md) routes human labels, ranker inputs, reference snapshots, and analytics calibration snapshots through immutable evidence before scoring.                                                                                                                                                                                                                       |
| 12. Contract edge cases               | [Contracts](contracts.md) define zero-observation, discriminated runtime/evidence payloads, catalog/profile hashes, severity rules, report/profile compatibility, and a version matrix.                                                                                                                                                                                                       |
| 13. Visual/human limitations          | [Visual design](visual-data-and-feedback.md) requires preregistration, baselines, ablations, held-out/OOD evaluation, failure criteria, presentation controls, uncertainty, and rater-effect preservation.                                                                                                                                                                                    |
| 14. Retention constraints             | [Visual/data design](visual-data-and-feedback.md) covers confounders, prohibited identity assumptions, noncompliance, and bans automatic generation/publication from observational, popularity, or preference signals without governed experiments and review.                                                                                                                                |
| 15. Documentation validation          | [E0 README](README.md) states the lightweight link/Mermaid validation policy; relative links and Mermaid blocks are reviewed before commit without adding a dependency stack.                                                                                                                                                                                                                 |

## Settled versus deferred

Settled: invariant precedence; discriminated metric provenance; content-addressed catalog/profile;
named non-self-referential hash domains; E1 no aggregate; immutable deletion overlays;
E1a/E1b/E1c boundaries; and screenshot protocol status as draft.

Deferred with explicit gates: a physics proof standard; Studio transport and multiplayer feasibility;
final screenshot environment/profile values; visual worker/model selection; dataset legal approvals;
calibrated thresholds/weights; analytics cohorts/privacy thresholds; rater policy; desktop packaging;
and a correction-patch contract.

## Final hash-preimage re-audit correction

The focused re-audit found that `executionEnvelopeHash` and `reportPayloadHash` could be read as
self-referential, evidence time/identity membership was conditional, and configuration hash
preimages were incomplete. The corrected
[hash and reproducibility section](contracts.md#hash-and-reproducibility-domains) closes that issue
only through:

- `ExecutionEnvelopePreimage`, `CalculationBundlePreimage`, `EvidenceContentPreimage`,
  `ReportPayloadPreimage`, and `ReportRenderPreimage`;
- `MetricDefinitionPreimage`, `MetricCatalogPreimage`, `ScoringProfilePreimage`,
  `EvaluationPlanConfigurationPreimage`, and `MetricCalculationPreimage`;
- exhaustive static, runtime, screenshot, learned-feature, performance, reference, human, and
  analytics evidence-kind rules with separate content and execution envelopes;
- `obby-canonical-json-v1`, including self-hash exclusion, ordering, Unicode, numeric, null, and
  invalid-value rules;
- illustrative separate-execution and separate-renderer examples.

Every resulting hash field is excluded from its own named preimage. The issue is closed at the
documentation-contract level; no implementation or computed test vector is claimed in E0.
