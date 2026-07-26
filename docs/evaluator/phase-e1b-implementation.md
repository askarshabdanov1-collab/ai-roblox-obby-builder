# Phase E1b implementation record

## Scope delivered

Phase E1b adds `@obby/route-playability-evaluator`, extending E1a without beginning E1c. It builds
declared route topology, conservative coarse playability evidence, an integrity-checked evidence
DAG, and evidence-linked findings. Native Roblox Parts remain the gameplay/collision authority.

## Route graph and topology policy

The route ID is the SceneManifest `sceneId`. Node zero is the single spawn. Remaining nodes and
required forward edges come only from `safeRouteObjectIds`, `routeEntries`, and ordered stage
declarations. Explicit `order`, `routeOrder`, and `stageRouteOrder` own semantics, so caller array
shuffling is normalized before Phase 0 semantic/hash validation. Object IDs are preserved; the
evaluator contract accepts Phase 0 Pascal IDs and already-committed E1a stable fixture IDs.

Validation fails closed with deterministically ordered typed issues for unknown or decorative route
references, duplicate route/stage indexes, missing stages, disconnected declarations, self or
reversed transitions, inconsistent route-entry metadata, missing/duplicate/misordered finish, and
required dead ends. Hazards, decoration, proximity, and construction order never create required
edges. Phase 0 has no side-branch declaration, so E1b records an empty side-branch collection
instead of inventing one.

Structural connectivity and coarse model feasibility remain separate. A connected graph can
contain `infeasible-under-model` or `indeterminate` transitions.

## Controller-profile policy

`ControllerProfile` is a closed, versioned, content-addressed contract.
`controllerProfileHash` is SHA-256 over `ControllerProfilePreimage` under
`obby-canonical-json-v1`. The preimage excludes its own hash, timestamps, execution/session IDs,
host/environment data, and storage metadata. Supported-surface and limitation sets are sorted.
Changing a limit, avatar dimension, surface set, tolerance, model/version, or classification changes
the hash.

The `e1-r15-provisional@1.0.0` profile uses the Phase 0 engineering defaults of six studs horizontal
gap, five studs rise, and twenty studs downward drop. These and avatar dimensions are provisional,
not live engine facts. Landing margin is calibration-required; inclusive comparison/tolerance is
invariant. No value claims exact Roblox physics.

## Coarse transition semantics

Each adjacent required transition binds route indexes, normalized endpoint geometry, controller
profile, input evidence hashes, horizontal AABB separation, surface-envelope rise/drop, surface
categories, approximation, tolerance, limitations, result ID, and metric ID. States are limited to:

- `feasible-under-model` for supported surfaces within every inclusive profile limit;
- `infeasible-under-model` when a supported transition exceeds a named profile limit;
- `indeterminate` for unsupported surfaces or insufficient evidence.

The confidence basis says a deterministic rule ran on complete bounded inputs. It is not a
probability or calibrated score. Broad-phase measurements stay labeled. Finite rules never prove
universal impossibility; future controller trials are profile-specific empirical evidence and must
remain separate.

## Evidence and findings

E1b adds closed payloads for route graph, coarse state, route summary, checkpoint/finish topology,
hazard relationship, skip candidate, softlock candidate, and future coarse/runtime conflict, and
tightens route-transition reproduction.
Every emitted record binds manifest, subject, producer, parents, limitations, reproduction method
and inputs, and `evidenceContentHash`. Scene-level evidence may aggregate same-manifest child
subjects; other parent/child subjects must match or use a scene parent. Integrity validation checks
identities, manifest scope, unique IDs/hashes, parent resolution, and acyclicity.

Checkpoint evidence verifies order, route/stage membership, structural reachability, forward
progression, finish continuation, native authority, and records `progressionStateScope` as the Phase
0 `per-player` contract. Runtime isolation is `not-evaluated`; no Studio observations means missing
evidence, never pass. Finish
evidence verifies unique membership, order after checkpoints, structural reachability, authority,
and whether the coarse path is feasible, contains model-relative infeasibility, or is indeterminate.

Route summary evidence records feasible, model-infeasible, indeterminate, and excessive-drop counts.
Because Phase 0 has no overhead route-region metadata, clearance remains explicitly indeterminate.
The conflict payload preserves future coarse and runtime evidence hashes as separate parents; E1b
does not create runtime observations.

Hazard evidence labels world-AABB overlap and full landing-surface consumption as candidates, not
confirmed native-shape collision. KillFloor consistency uses gameplay-authoritative placement and
bounds rather than a literal object ID. Conservative non-adjacent reach produces typed checkpoint
bypass, spawn-to-late-route, checkpoint-to-finish, and required-stage skip candidates. Structural
dead ends produce softlock candidates. Candidate findings are non-blocking and cannot become
confirmed runtime failures.

## Determinism, limits, and fixtures

Equivalent semantic inputs produce identical graph, transition, evidence, finding order, and
hashes. Tests cover shuffled inputs, repeated runs, cardinal/diagonal/vertical directions, exact and
epsilon limits, wedge metadata, unsupported curved surfaces, multiple checkpoints/stages, invalid
references, hazards, skips, softlocks, and all budgets.

Defaults are one route, 10,000 nodes, 10,000 transitions, 1,000 checkpoints, 1,000 hazards, 50,000
evidence records, and 200,000 traversal work units. Limits are deterministic non-negative safe
integers. Traversal is iterative and aborts at the work budget.

The fixture registry pins the real Phase 0 vertical-slice manifest hash and names all required
valid/invalid probes. The generated reference fixture contains real controller/evidence/parent
hashes. Positive fixtures prohibit zero/placeholder hashes. Generation is explicit and drift checks
are non-mutating.

## Acceptance checklist

- [x] Declared graph and forward topology are deterministic and fail closed.
- [x] Controller profile and evidence identities are content-addressed.
- [x] Coarse states remain model-relative and separate from structural invariants.
- [x] Checkpoint, finish, hazard, skip, and softlock evidence/finding foundations exist.
- [x] Evidence integrity, ordering, and bounded work are tested.
- [x] Build, plain-Node import, root tests, validation, and both CI platforms include E1b.
- [x] Generated fixture drift has an owner and non-mutating check.
- [x] E1c and all external/runtime integrations remain excluded.

## Deferred

E1c owns gate application, metric/category result assembly, evidence completeness calculations,
final reports, and the public CLI. Studio feasibility owns runtime trials, multiplayer checkpoint
isolation, engine-specific physics evidence, and dynamic hazards. Visual ML, screenshots, human
preferences, analytics, desktop/cloud packaging, and external orchestration remain outside E1b.
