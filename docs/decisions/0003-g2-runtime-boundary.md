# ADR 0003: G2 runtime boundary and trust model

- Status: Accepted for G2a
- Date: 2026-07-30
- Scope: runtime decisions and documentation only

## Context

G1d produces a validated `LayoutBundle`, PlaceSpec `0.3`, SceneManifest `0.3`, and a deterministic
Luau transport. The active Roblox builder still consumes only SceneManifest `0.2`. G2a decides the
runtime boundary before any `0.3` loader, construction, session, or bootstrap code is written.

The SceneManifest schema is authoritative. This ADR interprets existing fields for Roblox runtime
use; it does not change the schema, compiler, emitter, generated artifacts, active bootstrap, or
`0.2` behavior. Roblox Studio evidence is required before any engine-dependent decision is called
accepted in practice.

## Decision 1: Spawn semantics

The manifest gameplay object with role `spawn` remains the only gameplay surface and collision
authority. The runtime will additionally create exactly one non-authoritative `SpawnLocation` as
runtime infrastructure because the manifest object is contractually a `Part` and the engine may
need a `SpawnLocation` when selecting an initial character spawn.

The infrastructure object will:

- be named `_RuntimeSpawnLocation` and live in a reserved `RuntimeInfrastructure` folder owned by
  the candidate scene;
- be anchored, invisible (`Transparency = 1`), non-colliding, non-touching, and non-querying;
- be centered horizontally on the manifest spawn and placed so its top plane matches the gameplay
  spawn's top plane;
- have no source reference, route membership, gameplay behavior, or manifest identity effect;
- be created and destroyed with its scene candidate and never survive scene replacement; and
- never replace explicit HumanoidRootPart placement after `CharacterAdded`.

This is the selected G2 construction policy, not a claim that Roblox requires the helper in every
engine version. G2e must compare initial spawning with the packaged helper present, record the
Studio version, and prove that exact character placement still comes from the placement controller.
The helper may not be removed or made authoritative without a later decision backed by Studio
evidence.

## Decision 2: Wedge mapping

For SceneManifest `0.3`, `className: "Part"` names the logical native-Part primitive family; `shape`
selects the concrete Roblox primitive. `Block`, `Ball`, and `Cylinder` use `Part` with the matching
`PartType`. `Wedge` uses `WedgePart`, because a `Part` cannot represent wedge geometry.

The future validator must accept only the committed `className: "Part"` plus one known shape. The
factory will name the resulting Instance from the manifest ID, apply the same transform, size,
appearance, collision, behavior, and source-reference rules as any gameplay object, and verify
`IsA("BasePart")`. A concrete class mismatch fails candidate construction before activation. No
fallback Block is allowed. Failure destroys the candidate and preserves the active scene.

This interpretation does not widen the schema and does not make `WedgePart` an external asset.

## Decision 3: Manifest hash trust

G2 uses a staged hybrid trust model:

1. The only admitted transport is a repository-packaged ModuleScript selected by explicit runtime
   configuration. Requiring that ModuleScript executes code, so repository review, fixture drift
   checks, and the Rojo build boundary are part of the trust boundary.
2. The future loader will compare the returned manifest's declared `manifestHash` with the exact
   expected hash configured beside the transport, then snapshot and semantically validate all data
   used for construction.
3. G2 does **not** recompute the TypeScript canonical SceneManifest hash in Luau. The current Luau
   validator checks hash syntax, not content equivalence.

Therefore G2 authenticates neither arbitrary ModuleScript source nor arbitrary tables supplied at
runtime. Expected-hash equality identifies the reviewed package but is not content authentication
without canonical recomputation. Network input, dynamically uploaded modules, mutable caller tables,
and unreviewed transports remain outside the boundary and must fail closed. Supporting them requires
a later hash/canonicalization ADR and compatible test vectors.

## Decision 4: Authoritative runtime transport

The authoritative reference is
`examples/g1-workflow/reference/scene-manifest-v0.3.luau`, owned by
`tools/g1-workflow-fixture-content.ts` and checked by
`npm run layout:workflow:fixtures:check`. It is the representative 15-stage G1d artifact and is the
only existing `0.3` transport used as the G2 reference oracle.

`roblox/generated/G1cReferenceManifest.luau` is retained as historical G1c validator coverage. It
was produced at a different pipeline checkpoint, is not byte-identical to the G1d reference, and
must not be silently substituted in G2 runtime or Studio acceptance. G2 fixture publication into a
Rojo project will remain generated from the G1d owner, never copied or edited by hand.

## Decision 5: Scene replacement

G2 will use a bounded, off-Workspace candidate followed by a no-yield activation sequence. It is an
application-level absent-or-complete visibility protocol, not an engine-level atomic transaction.
All validation, allocation, property assignment, invariant checks, lookup construction, and
connection preparation happen before activation. The current-session pointer is the authority used
by every callback. Exact ordering and rollback boundaries are defined in
[`g2-scene-replacement.md`](../generator/g2-scene-replacement.md).

## Decision 6: Cross-version behavior

Live `0.2` to `0.3` or `0.3` to `0.2` replacement is prohibited. Runtime version selection is
explicit and fixed for a server lifetime. A version change requires configuration change and a
fresh server. Version-specific owner markers prevent either builder from claiming the other's root.

Rollback selects `0.2`, starts a fresh server, and uses the existing `0.2` fixture, builder, and
smoke procedure. The active `0.2` bootstrap remains unchanged until all G2 gates, including manual
Studio execution, pass.

## Decision 7: Player-state semantics

Checkpoint and finish state are keyed by player identity and `manifestHash`; generation tokens are
runtime guards, not semantic state keys. A same-manifest rebuild preserves valid checkpoint and
finish state. A new manifest activation clears visible attributes and makes old-manifest state
unavailable before new placement. Checkpoints store IDs and route order, not Instance or manifest
table references. Player removal clears all player state.

Every `CharacterAdded`, delayed root, checkpoint, kill, and finish callback must verify player,
character where applicable, manifest hash, current generation token, current root, and object ID.
A stale callback is a no-op. The full lifecycle is defined in
[`g2-player-session-lifecycle.md`](../generator/g2-player-session-lifecycle.md).

## Decision 8: Performance measurement

G2e will measure in Roblox Studio on Windows and record the exact Studio version, OS build, Play
mode, fixture identities, cold and repeated build observations, object counts, connection counts,
memory observations, and output errors. It will use the authoritative representative fixture and a
generated maximum 50-stage fixture.

G2a sets no millisecond pass threshold because no runtime measurements exist. G2e must report the
raw measurements and propose any threshold through review before runtime cutover. Functional
boundedness, contract maxima, and absence of unbounded waits remain automated gates.

## Decision 9: Fixture coverage

Fixture ownership is split by evidence type:

- the committed G1d representative and zero-checkpoint/50-stage source cases remain owned by the
  G1 workflow generator;
- G2 construction fixtures for Wedge and decorative Parts will be generated from contract-valid
  inputs by a future G2 fixture owner;
- replacement success uses two distinct valid generated manifests;
- replacement failure uses deterministic injected failure points, never a hash-invalid mutation;
- stale-callback and two-player cases are runtime scenarios over valid fixtures.

No G2 runtime fixture is edited by hand. Exact paths and future owners are specified in
[`g2-fixtures-and-drift.md`](../generator/g2-fixtures-and-drift.md).

## Decision 10: Validator parity

TypeScript schema and semantic validation remain the publication authority. Before G2b may admit a
manifest for construction, Luau must close the documented gaps for unknown/additional properties,
numeric bounds, complete source/decorative/stage reference closure, route-entry coordinates,
transition details, object/decorative fields, and all contract maxima. The intentional exception is
canonical manifest hash recomputation under Decision 3.

The parity matrix in [`g2-validator-parity.md`](../generator/g2-validator-parity.md) identifies each
current gap as a G2b blocker. No unsupported rule may be silently treated as equivalent.

## Consequences

- G2a adds documentation and consistency checks only.
- SceneManifest `0.3` remains validation-only and cannot construct or replace a Roblox scene.
- The active `0.2` runtime and bootstrap remain the rollback path.
- G2b may start only after every acceptance item in `g2a-acceptance.md` passes.
- Dynamic mechanics, external assets, networking, cloud services, analytics, deployment, and Studio
  automation remain out of scope.
