# `@obby/route-playability-evaluator`

Phase E1b deterministic route topology and coarse playability evidence. The package consumes a
validated `SceneManifest`, normalizes native-Part geometry through `@obby/geometry-evaluator`, and
uses only committed `navigation.stages`, `safeRouteObjectIds`, and `routeEntries` as route truth.
Gameplay insertion order, hazards, spatial proximity, and decoration never define the required
route.

The public library exports route graph construction, a content-addressed provisional controller
profile, coarse transition classification, typed limits/errors, and
evidence/finding assembly. Package exports point to `dist`; the repository smoke test imports the
built package with plain Node.

Coarse states are exactly `feasible-under-model`, `infeasible-under-model`, and `indeterminate`.
They use conservative world-AABB and surface-envelope measurements, are relative to a named
controller profile, and are not exact Roblox physics. Finite static rules cannot establish
universal impossibility. Unsupported curved surface combinations are indeterminate. Future runtime
trials remain separate empirical evidence and cannot overwrite static components.

The public transition result carries endpoint and transition identity, profile ID/version/hash,
evidence-only input hashes, stable reason codes, deterministic non-probabilistic confidence
semantics, and versioned normalized reproduction inputs. Required measurements are closed,
explicitly tagged `available` or `unavailable` variants; unavailable evidence yields
`indeterminate`, while missing tags, mixed variants, extra fields, and malformed evidence fail with
a typed deterministic error. Every available gap/rise/drop measurement requires canonical,
deduplicated `evidenceHashes`. The selected route-transition payload content-addresses its permitted
sources in `measurementSourceEvidenceHashes`. Those sources must be direct parents for the expected
manifest, use a scene subject, and have kind `geometry-fact` or `route-graph`; the route source must
name the selected route. Every declared, cited, or additional direct-parent `route-graph` must have
the selected transition's `routeId`; a single mismatched route source fails the entire binding.
Evidence-backed measurement hashes must be a non-empty subset of that
declared set. Standalone classification is deliberately evidence-free, so every available
`evidenceHashes` and unavailable `missingEvidenceHashes` list, including an unavailable landing
region, must be empty. It returns an empty `inputEvidenceHashes` and records normalized input
identity separately as `normalizedInputHash`.

Evidence-backed classification accepts a complete evidence collection and an explicit expected
manifest hash. It validates the entire graph before classification, requires exactly one matching
route-transition record, resolves and checks every declared measurement source and supplied
measurement hash, ignores unrelated records in the validated collection without changing any
result bytes, and returns only the selected transition record hash in `inputEvidenceHashes`.
Wrong-subject, wrong-manifest, wrong-kind, unrelated-parent, unresolved, cyclic, stale, duplicate,
or ambiguous evidence fails closed. Public E1b entry points validate and canonically copy every
caller-supplied hash list; malformed hashes produce typed validation errors and caller arrays are
never mutated.

For Block top faces and Wedge slopes, landing fit uses the two exact intrinsic planar edge spans.
Sorted avatar width/depth requirements are `avatarSpan + 2 * requiredLandingMargin`; each span fits
when `available + max(profileTolerance, geometryTolerance) >= required`. Circular, curved, or absent
landing regions are indeterminate. Height is deliberately absent from the profile and its hash
because E1b has no authoritative overhead envelope; vertical-clearance evaluation is deferred.

The package emits discriminated route graph, route transition, coarse state, route summary,
checkpoint, finish, hazard relationship, and skip candidate evidence. The
contract also models a future derived coarse/runtime conflict without collecting runtime data.
Candidate evidence never becomes a confirmed runtime failure. Checkpoint topology binds progression
state to the Phase 0 `per-player` scope but explicitly reports runtime isolation as
`not-evaluated`/missing evidence. Hazard consumption and KillFloor containment remain world-AABB
broad-phase candidates; KillFloor consistency is derived from gameplay-authoritative bounds rather
than an object name.
Skip evidence records whether a non-adjacent candidate is a checkpoint bypass, spawn-to-late-route
edge, checkpoint-to-finish edge, or required-stage skip. Independent rule contributions for the
same source/target key merge into one candidate with canonically ordered kinds. Hazard records are
already structurally unique by hazard, route subject, and relationship kind; no unsupported hazard
deduplication claim is made.

Static softlock evidence is unavailable in E1b. Phase 0 has one structurally valid linear required
route and no authoritative optional-branch, enclosure, recovery, or one-way-mechanic metadata.
Required-route dead ends remain typed topology validation errors. Runtime softlock observations and
richer static softlock classes are deferred.

The canonical Unicode-scalar comparator owns semantic ordering; host locale never does.
Deterministic budgets bound routes, nodes, transitions, checkpoints, hazards, evidence records, and
graph work. Traversal is iterative. No manifest content is executed and the package performs no
network access.

Fixtures are test-owned and repository-local. `npm run evaluator:route:fixtures:generate` owns the
generated vertical-slice evidence fixture; `npm run evaluator:route:check` is non-mutating and fails
on drift.

This package intentionally contains no scoring, aggregate/category weighting, approval decision,
final report, CLI workflow, Studio/plugin/MCP integration, runtime collection, screenshots, visual
ML, human preference model, analytics, scraping, training, desktop/cloud component, or orchestration
framework.
