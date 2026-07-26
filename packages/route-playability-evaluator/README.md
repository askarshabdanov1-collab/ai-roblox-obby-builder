# `@obby/route-playability-evaluator`

Phase E1b deterministic route topology and coarse playability evidence. The package consumes a
validated `SceneManifest`, normalizes native-Part geometry through `@obby/geometry-evaluator`, and
uses only committed `navigation.stages`, `safeRouteObjectIds`, and `routeEntries` as route truth.
Gameplay insertion order, hazards, spatial proximity, and decoration never define the required
route.

The public library exports route graph construction, a content-addressed provisional controller
profile, coarse transition classification, structural softlock detection, typed limits/errors, and
evidence/finding assembly. Package exports point to `dist`; the repository smoke test imports the
built package with plain Node.

Coarse states are exactly `feasible-under-model`, `infeasible-under-model`, and `indeterminate`.
They use conservative world-AABB and surface-envelope measurements, are relative to a named
controller profile, and are not exact Roblox physics. Finite static rules cannot establish
universal impossibility. Unsupported curved surface combinations are indeterminate. Future runtime
trials remain separate empirical evidence and cannot overwrite static components.

The package emits discriminated route graph, route transition, coarse state, route summary,
checkpoint, finish, hazard relationship, skip candidate, and softlock candidate evidence. The
contract also models a future derived coarse/runtime conflict without collecting runtime data.
Candidate evidence never becomes a confirmed runtime failure. Checkpoint topology binds progression
state to the Phase 0 `per-player` scope but explicitly reports runtime isolation as
`not-evaluated`/missing evidence. Hazard consumption remains a world-AABB broad-phase candidate;
KillFloor consistency is derived from gameplay-authoritative bounds rather than an object name.
Skip evidence records whether a non-adjacent candidate is a checkpoint bypass, spawn-to-late-route
edge, checkpoint-to-finish edge, or required-stage skip.

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
