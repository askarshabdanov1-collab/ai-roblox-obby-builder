# Phase E1a completion record

## Implemented boundary

Phase E1a adds two workspaces:

- `@obby/obby-evaluator-contracts`: schema-derived types, runtime validation, semantic checks,
  content identities, E1-only catalog/profile fixtures, and golden hash vectors;
- `@obby/geometry-evaluator`: deterministic native-Part geometry and route-transition input
  normalization.

The evaluator schema is version `0.1` and fails closed on unknown versions, discriminants,
properties, malformed IDs/hashes, non-finite numbers, invalid source/result combinations, broken
evidence parent references, invalid transition identities, and unsupported geometry. The
structural schema remains the source of truth; cross-field checks remain in the semantic validation
layer.

## Identity policy

`obby-canonical-json-v1` emits UTF-8, normalizes strings and keys to NFC, orders object keys by
Unicode scalar value, preserves ordinary array order, explicitly sorts only declared set-like
collections, rejects sparse arrays and unsupported JavaScript values, permits finite binary64
numbers only, and normalizes negative zero and exponent spelling. It does not claim RFC 8785
compatibility.

The following named SHA-256 preimages are implemented and covered by checked-in canonical-byte
vectors:

- `MetricDefinitionPreimage`;
- `MetricCatalogPreimage`;
- `ScoringProfilePreimage`;
- `EvaluationPlanConfigurationPreimage`;
- `EvaluationRequestPreimage`;
- `EvidenceContentPreimage`;
- `CalculationBundlePreimage`;
- `AvailabilityRecordPreimage`.

Every helper validates first, excludes its own result field, uses lowercase `sha256:` output, and
returns the canonical bytes. Request envelope fields and plan authoring time are excluded from their
deterministic identities as defined in Phase E0.

## Geometry policy

Geometry uses studs and intrinsic XYZ Euler degrees. Angles normalize to `[-180, 180)`. Each object
retains its ID, shape, normalized center/rotation/size, oriented bounds, conservative world
axis-aligned bounds, top-surface support/approximation markers, safe-route reference, and collision
authority. Transition normalization references declared source/destination IDs and computes only
horizontal surface gap, vertical rise, downward drop, and surface/profile inputs.

Ball, Cylinder, and Wedge support summaries retain conservative approximation markers where a box
bound is not an exact surface model. No result is labeled feasible, infeasible, indeterminate,
impossible, or playable.

## Fixtures and generation

`npm run evaluator:contracts:generate` owns generated TypeScript, the E1 catalog, E1 profile, metric
definitions, and golden hash vectors. `npm run evaluator:contracts:check` validates the schema and
fails on byte drift. Geometry fixtures cover horizontal, rising, downward, rotated, Wedge,
Cylinder, invalid non-finite, decorative-target, and missing-reference cases.

The E1 fixture catalog describes metrics planned for later E1 work; its presence does not claim
that E1a calculates them. The profile contains only playability and policy categories, exposes no
aggregate score, uses no missing-category renormalization, and keeps uncalibrated profile status
provisional.

## Explicitly deferred

E1a does not implement route topology or verdicts, coarse feasibility states, checkpoint/finish/
hazard/softlock/skip evaluation, gate application, aggregate or category scoring, report
generation, an evaluator CLI/workflow, evidence persistence, Studio/plugin/MCP behavior,
screenshots, visual or learned models, analytics, scraping, training, cloud infrastructure,
desktop packaging, correction workflows, or agent orchestration. These boundaries are unchanged
from the reviewed E1 plan.

## Deviations from Phase E0

There are no intentional contract-identity deviations. The E1a implementation keeps the planned
package names and command ownership. Finalized report schemas/hashes and end-to-end report fixture
commands remain deferred to E1c because the task explicitly prohibits report hashing beyond the
minimal E1a foundation.
