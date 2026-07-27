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
Changing a limit, avatar landing-footprint dimension, surface set, tolerance, model/version, or
classification changes the hash. The footprint contains width and depth only. Height is excluded:
Phase 0/E1a has no authoritative overhead route envelope, so vertical-clearance evaluation remains
`indeterminate-no-overhead-route-metadata` rather than inventing movement physics.

The `e1-r15-provisional@1.0.0` profile uses the Phase 0 engineering defaults of six studs horizontal
gap, five studs rise, and twenty studs downward drop. These and avatar footprint dimensions are provisional,
not live engine facts. Landing margin is calibration-required; inclusive comparison/tolerance is
invariant. No value claims exact Roblox physics.

## Coarse transition semantics

Each adjacent required transition binds route indexes, normalized endpoint geometry, controller
profile, evidence-only input hashes, horizontal AABB separation, surface-envelope rise/drop, surface
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
hazard relationship, skip candidate, and future coarse/runtime conflict, and
tightens route-transition reproduction.
Every emitted record binds manifest, subject, producer, parents, limitations, reproduction method
and inputs, and `evidenceContentHash`. Scene-level evidence may aggregate same-manifest child
subjects; other parent/child subjects must match or use a scene parent. Integrity validation checks
identities, manifest scope, unique IDs/hashes, parent resolution, and acyclicity.

`inputEvidenceHashes` contains only the selected verified route-transition record emitted in that returned graph. The
controller profile has its dedicated hash field; normalized reproduction data has
`normalizedInputHash`. Every available gap/rise/drop measurement requires canonically sorted,
deduplicated `evidenceHashes`. The selected route-transition payload declares the content-addressed
permitted set in `measurementSourceEvidenceHashes`. Each source must be its direct parent on the
expected manifest, be scene-scoped, and have kind `geometry-fact` or `route-graph`; the route source
must name the selected route. The invariant applies to every declared, cited, and additional direct
route-graph parent; one mismatched `routeId` fails with `measurement-source-route-mismatch`. Every
evidence-backed available measurement must cite a non-empty
subset of this set. Standalone classification has no evidence graph, so every available
`evidenceHashes` and unavailable `missingEvidenceHashes` list, including an unavailable landing
region, is empty-only and its result returns an empty evidence-hash list.

Evidence-backed classification receives a complete evidence collection plus the expected manifest
hash and validates the graph before applying model rules. It requires exactly one route-transition
record matching manifest, subject, indexes, endpoints, and transition ID. It resolves every
declared measurement source and caller-supplied measurement hash, checks the permitted relationship,
kind, subject, route, and manifest, and normalizes valid caller arrays without mutation. Unrelated
records in an otherwise valid complete graph are byte-inert rather than leaked into reproduction
inputs or `inputEvidenceHashes`. Empty required measurement evidence, stale, unresolved, cyclic,
wrong-kind, unrelated-parent, wrong-subject, wrong-manifest, duplicate-conflicting, or ambiguous
evidence fails closed.

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

Hazard evidence labels world-AABB overlap, full landing-surface consumption, and KillFloor bounds as
candidates, never confirmed native-shape collision or containment. KillFloor consistency uses
gameplay-authoritative placement and bounds rather than a literal object ID. Conservative
non-adjacent reach produces typed checkpoint bypass, spawn-to-late-route, checkpoint-to-finish, and
required-stage skip candidates. Candidate findings are non-blocking and cannot become confirmed
runtime failures. Each applicable skip rule contributes independently to a canonical source/target
key; contributions merge into one candidate with sorted `candidateKinds`. Hazard relationships are
structurally unique by hazard, route subject, and relationship kind, so E1b has no hazard
deduplication layer and makes no such claim.

Static softlock evidence is intentionally unavailable in E1b. Phase 0 provides one required linear
route but no authoritative optional branches, enclosure regions, recovery actions, or one-way
mechanic metadata. Required-route dead ends are topology validation errors. Branch-return,
enclosure, model-relative, and runtime softlock evidence remain deferred; the E1b public evidence
union contains no unreachable static softlock payload.

The public coarse transition result is the authoritative classification representation. It includes
transition and endpoint identity, controller profile ID/version/hash, input evidence hashes, stable
reason codes, deterministic non-probabilistic confidence semantics, limitations, and versioned
normalized reproduction inputs. Required measurements are explicitly available or unavailable.
Available and unavailable variants are closed and require an explicit `status`. Available
measurements require value, method, approximation, tolerance, evidence hashes, limitations, and
applicability. Unavailable measurements require reason, missing-evidence hashes, and limitations.
Untagged, mixed, extra-field, duplicate-invalid, and otherwise malformed payloads produce a typed
deterministic validation error. Duplicate valid evidence hashes are canonically deduplicated and
Unicode-scalar sorted. Well-formed unavailable measurement or landing evidence yields
`indeterminate`.

Landing margin uses exact intrinsic planar edge spans for Block top faces and Wedge slopes. Sorted
avatar width/depth requirements are `avatarSpan + 2 * requiredLandingMargin`; each available span
must satisfy `available + max(profileTolerance, geometryTolerance) >= required`. Curved, circular,
or missing landing regions are indeterminate. Direct skip candidates call the same classifier.

## Determinism, limits, and fixtures

Equivalent semantic inputs produce identical graph, transition, evidence, finding order, and hashes.
Semantic identities and diagnostics use the repository Unicode-scalar comparator, never host locale.
Tests cover shuffled inputs, repeated runs, cardinal/diagonal/vertical directions, exact/inside/outside
tolerance boundaries for gap, rise, drop, and landing spans, missing and malformed measurements,
wedge metadata, unsupported curved surfaces, multiple checkpoints/stages, invalid references,
hazards, skips, deferred softlock scope, and all budgets.

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
- [x] Checkpoint, finish, hazard, and skip evidence/finding foundations exist; static softlocks are explicitly deferred pending authoritative metadata.
- [x] Evidence integrity, ordering, and bounded work are tested.
- [x] Build, plain-Node import, root tests, validation, and both CI platforms include E1b.
- [x] Generated fixture drift has an owner and non-mutating check.
- [x] E1c and all external/runtime integrations remain excluded.

## Independent-audit remediation

| Blocker                                                | Correction                                                                                                                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 — landing margin was identity-only                  | Exact intrinsic planar spans now apply avatar width/depth and twice the configured margin in required-route and shared skip classification; unsupported avatar height was removed.            |
| B2 — missing measurements caused incidental exceptions | Closed, explicitly tagged available/unavailable measurement and landing evidence produces stable indeterminate reasons; malformed payloads raise `CoarseTransitionValidationError`.           |
| B3 — public transition results were incomplete         | `CoarseTransitionResult` carries endpoint/transition/profile identity, evidence-only input hashes, a separate normalized-input hash, reason codes, confidence, limitations, and reproduction. |
| B4 — broad-phase KillFloor containment was confirmed   | E1b permits only candidate/not-detected/indeterminate hazard assessments and records conservative method, approximation, tolerance, and limitations.                                          |
| B5 — semantic ordering used host locale                | E1b uses the shared Unicode-scalar comparator for identities, diagnostics, evidence inputs, and findings.                                                                                     |
| B6 — static softlock support was unreachable           | The unreachable static evidence payload/detector was removed; required-route dead ends are topology errors and unsupported softlock classes are explicitly deferred.                          |

### Final focused remediation

| Blocker group                       | Final correction                                                                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unused avatar height                | Height was removed from the closed profile, generated declaration, fixture, and hash preimage; unsupported overhead clearance remains explicitly unavailable.                           |
| Untagged measurement compatibility  | Public inputs and compiled declarations accept only closed `available`/`unavailable` variants; compile-negative and runtime tests cover missing tags, mixed fields, extras, and hashes. |
| Non-evidence input hashes           | Full evaluation supplies verified route-transition records; standalone results use an empty list and a dedicated `normalizedInputHash`; emitted hashes are resolved before return.      |
| Misstated duplicate/malformed tests | Skip-rule contributions are genuinely aggregated by canonical pair. Hazard identities are structurally unique, so the false deduplication claim was removed and the invariant tested.   |

### Final merge-readiness remediation

| Blocker group                               | Correction                                                                                                                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Available measurements lacked evidence IDs  | `evidenceHashes` is required, content-hash validated, canonically deduplicated/sorted, populated from emitted geometry/route evidence during full evaluation, and explicitly empty only for standalone use. |
| Evidence-backed classification leaked input | The public helper now validates a complete graph under an expected manifest, selects one exact transition with required parents, ignores unrelated valid records, and rejects invalid or ambiguous graphs.  |

### Final evidence-binding remediation

| Blocker group                               | Correction                                                                                                                                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Measurement hashes were only format-checked | Route-transition evidence now content-addresses `measurementSourceEvidenceHashes`; evidence-backed classification accepts only non-empty measurement subsets resolving to declared direct scene-scoped `geometry-fact`/selected `route-graph` parents. |
| Standalone accepted unverified hashes       | Standalone available and unavailable measurement hashes, including unavailable landing evidence, are empty-only and fail with typed deterministic validation errors otherwise.                                                                         |
| Public helper bypassed hash validation      | `unavailableLandingRegion` now validates and canonically copies its hash list through the shared validator; the public classifier validates its complete graph and all embedded hash lists before classification.                                      |
| Unrelated graph evidence affected trust     | Regression coverage proves unrelated valid graph records are byte-inert, while nonexistent, wrong-manifest, wrong-subject, wrong-kind, unrelated-parent, bad-scope, and cyclic evidence fail closed.                                                   |
| Route matching used an existential check    | Every declared, cited, or additional direct-parent route graph must match the selected transition route; wrong-only and mixed correct/wrong sources fail deterministically.                                                                            |

## Deferred

E1c owns gate application, metric/category result assembly, evidence completeness calculations,
final reports, and the public CLI. Studio feasibility owns runtime trials, multiplayer checkpoint
isolation, engine-specific physics evidence, and dynamic hazards. Visual ML, screenshots, human
preferences, analytics, desktop/cloud packaging, and external orchestration remain outside E1b.
