# G2 SceneManifest 0.3 scene replacement specification

This specification defines the complete `0.3` replacement protocol. G2c implements the candidate
construction and root-only transaction subset described below; G2d still owns runtime sessions,
connections, player state, and production activation. The existing `0.2` `SceneBuilderCore`
continues to own the active path.

## G2c implemented subset

G2c completes steps 1–6 of pre-activation for construction data, validates Part counts and object-ID
lookup closure, and constructs no connections. Its `SceneBuilderCoreV03.commitCandidate` primitive
performs a no-yield root swap using a root pointer bound to the current manifest hash. It refuses
unowned, cross-version, ambiguous, pointer-inconsistent, and changed-identity roots; switches the
pointer before old-root destruction; rolls back all tested pre-pointer failures; and quarantines a
retired root when post-commit destruction fails.

The primitive is not called by `ObbyBootstrap` and does not implement a runtime session or generation
token. The session-aware activation steps and callback invalidation below remain normative G2d work.

## Terms and invariants

- **Candidate root:** a complete `AIObbyBuilder/0.3` Model constructed outside Workspace.
- **Runtime session:** immutable manifest snapshot, lookup maps, generation token, prepared
  connections, and player-state access for one manifest generation.
- **Current pointer:** the single server-local `(root, session)` authority consulted by every
  asynchronous callback.
- **Retired root:** an old root removed from Workspace and no longer authorized by the current
  pointer.

Before activation, the candidate has a temporary unique name, is parented to a private staging
container outside Workspace, and has an inactive session. The candidate owns every constructed Part,
the reserved runtime-infrastructure folder, and all prepared connections. It contains no reference
to mutable caller input.

At every observable boundary:

- Workspace contains either the previous complete active root or the new complete active root;
- there is at most one root named `GeneratedObby`;
- callbacks mutate state only when their session equals the current pointer; and
- a candidate failure does not modify the active root or player state.

This is an application-level no-yield protocol, not an engine-level atomic transaction or an exact
Roblox scheduler guarantee.

## Pre-activation sequence

All potentially expensive or routinely fallible work occurs here:

1. Require, snapshot, and validate the configured manifest and expected manifest hash.
2. Admit bounded work and produce a deterministic build plan.
3. Create the candidate root in private staging.
4. Construct all gameplay, decorative, and runtime-infrastructure Instances.
5. Apply attributes, transforms, appearance, collision, and behavior descriptors.
6. Build ID, route, checkpoint, and source-reference lookup maps.
7. Create event connections with callbacks guarded by the inactive candidate token. No callback may
   mutate while inactive.
8. Validate exact object counts, unique names/IDs, ownership, parent closure, route closure, spawn,
   finish, collision authority, and connection bounds.
9. Recheck that the current pointer still equals the value observed at admission.

Any error destroys the candidate, disconnects its connections, and returns a typed failure without
touching Workspace.

## No-yield activation sequence

The future implementation must place this sequence in one function containing no `wait`, task
scheduling, event wait, network call, user callback, or other yield-capable operation. All names and
references are prepared before entry.

1. Recheck the expected current pointer, candidate ownership, and candidate inactive state.
2. Mark the previous session `acceptingCallbacks = false`. Its callbacks now no-op, but it remains
   the rollback scene until the candidate is visible.
3. Rename the previous root to its precomputed retired name and set its `Parent` to the private
   retirement container.
4. Rename the candidate to `GeneratedObby` and set its `Parent` to Workspace.
5. Set the current pointer to the candidate root and session.
6. Set the candidate session `acceptingCallbacks = true`; keep the previous session invalidated.
7. Mark activation committed. From this point, the candidate is authoritative and rollback to the
   old session is prohibited.
8. Destroy the retired root.
9. Disconnect and clear previous-session callbacks and player-placement controllers.

Steps 2–7 are the commit window. Steps 8–9 are bounded cleanup after logical commit and still must
not yield. Roblox may schedule engine events around property changes; generation-token checks, not
event timing assumptions, provide stale-callback isolation.

## Failure-injection and rollback matrix

| Injection boundary             | Required result                                                                                                    | Active pointer | Cleanup                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------- |
| Load/snapshot/admission        | Previous scene unchanged                                                                                           | Previous       | No candidate allocation, or destroy partial snapshot state                                          |
| Plan creation                  | Previous scene unchanged                                                                                           | Previous       | Discard plan                                                                                        |
| Candidate root/Part creation   | Previous scene unchanged                                                                                           | Previous       | Destroy candidate and disconnect candidate callbacks                                                |
| Candidate invariant validation | Previous scene unchanged                                                                                           | Previous       | Destroy candidate and return invariant finding                                                      |
| Connection preparation         | Previous scene unchanged                                                                                           | Previous       | Disconnect partial candidate connections and destroy candidate                                      |
| Final current-pointer recheck  | Previous scene unchanged                                                                                           | Previous       | Destroy candidate; report stale admission                                                           |
| Previous-session invalidation  | Abort before moving either root                                                                                    | Previous       | Reactivate previous session; destroy candidate                                                      |
| Retire old root/name           | Restore old parent/name and callback acceptance                                                                    | Previous       | Destroy candidate; if restoration cannot be proven, fail closed and surface a fatal ownership error |
| Publish candidate root/name    | Remove candidate from Workspace, restore old root/name and callback acceptance                                     | Previous       | Disconnect/destroy candidate; fatal if restoration cannot be proven                                 |
| Current-pointer update         | This operation is a single in-memory assignment; injected failure occurs before assignment and rolls back as above | Previous       | Restore old; destroy candidate                                                                      |
| Candidate activation flag      | Pointer is already new; complete candidate activation synchronously                                                | New            | Old stays invalidated and retired; never reactivate it                                              |
| Old-root destruction           | New scene remains authoritative                                                                                    | New            | Quarantine retired root outside Workspace; report cleanup failure                                   |
| Old callback disposal          | New scene remains authoritative; old callbacks no-op by token                                                      | New            | Report cleanup failure and retain bounded disposal diagnostics                                      |

Tests must inject at every row, including restoration failure. A restoration failure must never
publish both roots or resume both sessions. The implementation must choose a safe terminal state and
return a fatal diagnostic rather than claim rollback success.

## Ownership and replacement eligibility

The future builder may replace a root only when:

- the configured runtime version is `0.3` for the full server lifetime;
- the root has `GeneratedBy = "AIObbyBuilder/0.3"`;
- its stored schema version, manifest hash, and generation token agree with the current pointer; and
- no second owned or unowned `GeneratedObby` root creates ambiguity.

An initial build uses the same candidate protocol with no previous root. A same-manifest rebuild
creates a new generation token and full candidate rather than mutating Parts in place. No live
cross-version replacement is allowed.

## Determinism and bounds

Construction order follows admitted manifest object order and explicit navigation order; it is not
derived from table-map iteration. Temporary retirement names and generation tokens may differ by
execution but are runtime-only and cannot affect manifest IDs, Part names, transforms, properties,
or route behavior.

Validation and planning must be linear in declared objects, stages, zones, route entries, and
transitions. Instance and connection allocation is bounded by contract maxima plus one scene root,
bounded folders, and one non-authoritative SpawnLocation. No retry or cleanup loop is unbounded.
