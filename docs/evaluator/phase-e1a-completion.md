# Phase E1a completion record

## Implemented boundary

Phase E1a adds two workspaces:

- `@obby/obby-evaluator-contracts`: schema-derived types, runtime validation, semantic checks,
  content identities, E1-only catalog/profile fixtures, and golden hash vectors;
- `@obby/geometry-evaluator`: deterministic native-Part geometry and route-transition input
  normalization.

The evaluator schema is version `0.1` and fails closed on unknown versions, discriminants,
properties, malformed IDs/hashes, non-finite numbers, invalid source/result combinations, stale
declared identities, broken evidence scope/parent references, invalid transition identities, and
unsupported geometry. Strict UTC timestamps are `YYYY-MM-DDTHH:mm:ssZ` or exactly three fractional
digits (`.sssZ`); calendar-invalid values are rejected. The
structural schema remains the source of truth; cross-field checks remain in the semantic validation
layer.

## Identity policy

`obby-canonical-json-v1` emits UTF-8, normalizes strings and keys to NFC, orders object keys by
Unicode scalar value, preserves ordinary array order, explicitly sorts only declared set-like
collections, rejects sparse arrays and unsupported JavaScript values, permits finite binary64
numbers only, and normalizes negative zero and exponent spelling. Inputs cross a descriptor-based
plain-data snapshot boundary before serialization. Descriptor snapshotting creates no canonical
text or bytes; validation, including AvailabilityRecord effective-identity XOR inspection, runs
only after the trusted snapshot exists. Enumerable accessors, symbols, unexpected
prototypes, inherited enumerable state, Date/Map/Set/typed-array/class instances, descriptor trap
failures, cycles, and NFC key collisions fail closed.

Default budgets are depth 64, 4,096 properties per object, 100,000 array entries, 200,000 visited
nodes, and 16 MiB of canonical UTF-8. Limit failures are typed
`CanonicalJsonValidationError` values, not recursion `RangeError`s. JavaScript has no portable
Proxy-brand check; the implementation therefore never performs ordinary property reads, snapshots
each accepted data descriptor value, converts trap/invariant failures to typed errors, and hashes
only the completed snapshot. A transparent Proxy that faithfully exposes stable ordinary
descriptors is observationally indistinguishable from its target.

The unversioned `canonicalStringify`/`sha256` API remains byte-compatible with Phase 0
`@obby/canonical-json` 0.2.0. Evaluator helpers explicitly use the separate
`obby-canonical-json-v1` entry points. It does not claim RFC 8785 compatibility.

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

Every helper snapshots raw input once without serialization, validates that snapshot, excludes its
own result field, builds its named preimage, serializes that preimage once, hashes those exact bytes,
and returns the same bytes with lowercase `sha256:` output. Direct tests
recompute every returned digest through Node `crypto`. Request envelope fields and plan authoring
time are excluded from their deterministic identities as defined in Phase E0.

The aggregate semantic validator verifies the complete MetricDefinition → MetricCatalog →
ScoringProfile → EvaluationPlan → EvaluationRequest graph. It resolves exact definition
identities, metric/invariant references, all required invariants, derived parents/cycles, plan
selection, actual catalog/profile/configuration/request hashes, and a deliberately narrow
semantic-version range grammar. It is the sole public request/plan binding boundary and requires the
complete actual MetricDefinition, MetricCatalog, ScoringProfile, EvaluationPlan, and
EvaluationRequest graph; the former standalone binding helper is not exported. Metric-definition
and evidence collections are snapshot-ordered by semantic non-hash keys and canonical tie-breakers
before identity checks, so identity-invalid shuffled inputs produce the same full issue list.
Set-like catalog, profile, plan, parent, and transition validation follows canonical semantic order.
Evidence graphs verify every content hash, duplicate ID/hash rules, parent existence, manifest
scope, compatible subjects, and deterministic acyclic traversal. Because parent hashes participate
in evidence content identities, a fully hash-valid cyclic public fixture would require a
cryptographic fixed point; the cycle algorithm is tested through an internal already-resolved-node
seam while public tests retain hash mismatch, missing-parent, duplicate, scope, and valid-acyclic
coverage.

Positive evaluator fixtures derive self identities through the named hash helpers and use pinned,
reviewable semantic sources for external manifest, geometry, calculation, producer, rule, and
availability identities. Silent all-zero defaults have been removed; the all-zero form remains only
in an explicitly named rejection regression.

## Geometry policy

Geometry uses studs and Roblox `CFrame.Angles`/`CFrame.fromEulerAnglesXYZ` composition in degrees.
Angles normalize to `[-180, 180)`. Each object retains its ID, shape, normalized
center/rotation/size, oriented bounds, conservative world axis-aligned bounds, shape-aware surface
descriptors, safe-route reference, and required collision/ownership/promotion facts. Block has an
exact transformed top plane/polygon; Cylinder has local-X circular endcaps and a curved side; Wedge
has an exact slope plane/polygon and non-sloped faces; Ball remains curved with a center, radius,
and top point.

The supported minimum dimension is `0.000001` studs. Coordinates, angles, and measurements use 12
decimal digits; transition measurements use a `0.000000001`-stud zero tolerance. Positive
dimensions below the minimum are rejected before rounding. Horizontal AABB separation and surface
envelope rise/drop are labeled conservative, include their method/tolerance/limitations, and are
`broad-phase-only`. No AABB overlap is called exact shape contact.

Collision/touch/query booleans, authority, gameplay ownership, and promotion state are mandatory.
Decorative collision/touch produces deterministic candidates but no finding. Route transitions
require native gameplay authority, adjacent forward indexes, matching route/object
`safeRouteRef`s, deterministic IDs, and unique collection IDs/tuples. No result is labeled
feasible, infeasible, indeterminate, impossible, or playable.

## Fixtures and generation

`npm run evaluator:contracts:generate` owns generated TypeScript, the E1 catalog, E1 profile, metric
definitions, and golden hash vectors. `npm run evaluator:contracts:check` validates the schema and
fails on byte drift without regenerating first. Committed canonical text is independently hashed by
Node `crypto`; a small manually pinned digest map covers every implemented hash family. These
vectors validate implementation consistency, not compliance with an external canonical-JSON
standard. Geometry fixtures cover horizontal, rising, downward, rotated, Wedge,
Cylinder, invalid non-finite, decorative-target, and missing-reference cases.

Generated `e1-identity-sources.json` commits small semantic sources for manifest, geometry, producer
build, rule build, availability-policy build, and fixture-generator identities. Generation fails if
any generated evaluator fixture contains an all-zero digest; the production fixture builder uses no
all-zero temporary identity.

Focused regressions cover a real three-node derived cycle, the resolved evidence-cycle guard,
strict UTC timezone/fraction/calendar cases, duplicate evidence IDs with distinct valid content,
minimum-dimension and binary64 rounding boundaries, exact near-zero gap policy, a genuinely rotated
Cylinder, every safe-route identity mismatch, shuffled transition ordering, and distinct duplicate
transition-ID/tuple checks.

The E1 fixture catalog marks metrics `planned` and calculations `unavailable-in-e1a`; its presence
does not claim that E1a calculates them. Semantic calculation configuration hashes come from
committed generated configuration fixtures rather than all-zero placeholders. The policy metric
requires only geometry evidence/capability. The profile contains only playability and policy categories, exposes no
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

The evaluator identity domain is explicitly separate from the unchanged Phase 0 canonical identity
API. The E1a implementation keeps the planned package names and command ownership. Finalized report
schemas/hashes and end-to-end report fixture commands remain deferred to E1c because the task
explicitly prohibits report hashing beyond the minimal E1a foundation.
