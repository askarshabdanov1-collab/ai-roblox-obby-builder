# G2c deterministic native-Part construction

G2c implements the construction-only SceneManifest `0.3` runtime boundary. It does not select the
`0.3` path from `ObbyBootstrap`, activate gameplay behavior, or replace the active `0.2` runtime.
The authoritative input remains the immutable result admitted by the G2b loader.

## Implemented modules

- `BuildPlanV03.luau` projects an admitted snapshot into frozen, ordered gameplay, decorative, and
  helper construction records. Planning allocates no Instances and performs no Workspace mutation.
- `NativePartFactoryV03.luau` maps `Block`, `Ball`, and `Cylinder` to native `Part` objects and maps
  `Wedge` to `WedgePart`. It applies declared transforms, sizes, appearance, collision properties,
  deterministic names, source-reference attributes, and scene identity attributes.
- `SceneBuilderCoreV03.luau` constructs a complete candidate in a private, unparented staging
  `Folder`, validates its hierarchy and lookup closure, and exposes a root-only replacement
  primitive for G2c tests and later G2d coordination.

These modules are libraries under `ReplicatedStorage/ObbyRuntime`. No production server script calls
them in G2c.

## Build plan and complexity

`BuildPlanV03.create` accepts only a frozen G2b admission envelope with the repository-module hash
trust marker. It preserves manifest object order, object IDs, source references, safe-route order,
zone order, manifest identity, and the exact declared Part data. Its structural identity is derived
only from versioned admitted semantic identity and ordered record identities; it contains no random
value, timestamp, Instance, or mutable caller table.

Planning is `O(objects + routes + zones)` in time and space. All loops use admitted arrays in their
declared order. The SceneManifest maxima admit at most 501 gameplay and 256 decorative Parts. G2c
adds one invisible helper `SpawnLocation` and six bounded non-Part containers, for a maximum of 758
Parts and 764 candidate Instances. A configured work limit is checked before the first allocation.

## Native construction rules

The manifest spawn remains an ordinary gameplay `Part` and retains gameplay authority. The sole
helper `SpawnLocation` shares its top plane and horizontal center, is invisible, and is forced to
`CanCollide = false`, `CanTouch = false`, and `CanQuery = false`. It is marked
`NonAuthoritative = true`.

All decoration is likewise forced non-colliding, non-touching, and non-querying even after admission.
Unsupported shapes, materials, malformed transforms, invalid collision data, and invalid runtime
adapters return typed, sanitized errors. The factory never infers checkpoint, hazard, finish, spawn,
or route behavior from names or construction order and creates no event connections.

## Candidate hierarchy and invariants

The complete staged hierarchy is:

```text
_G2PrivateStaging (Folder, outside Workspace)
└── _GeneratedObbyCandidate (Model)
    ├── Gameplay (Folder)
    ├── Decorative (Folder)
    ├── RuntimeInfrastructure (Folder)
    └── Metadata (Folder)
```

Before commit, G2c proves exact gameplay, decorative, helper, and total counts; parent closure; the
complete object-ID lookup; decoration/helper collision safety; and root, schema, scene, manifest,
and build-plan identity attributes. Any construction or validation error destroys the staging tree
without changing Workspace.

## Root-only replacement primitive

`SceneBuilderCoreV03.commitCandidate` is an application-level, no-yield root operation. It refuses
unowned, cross-version, duplicate, pointer-inconsistent, manifest-inconsistent, or changed candidate
roots. For a valid replacement it quarantines the previous root, publishes the complete candidate,
switches the root and manifest identity pointer, and only then destroys the previous root.

Every injected failure before the pointer switch restores the previous root and destroys the
candidate. A cleanup failure after the pointer switch leaves the new root authoritative and reports
a bounded cleanup diagnostic. This protocol does not claim engine-level atomicity or exact Roblox
scheduler behavior.

## Evidence and limits

Generated fixture ownership includes representative, Wedge, decorative, zero-checkpoint, 20-, 21-,
and 50-stage manifests; an independently hashed replacement manifest; and a valid 757-manifest-Part
maximum. Luau tests cover deterministic planning, exact shape/property construction, lookup closure,
N−1/N/N+1 budgets, all pre-pointer failure boundaries, ownership refusal, rollback, and cleanup.
The generated fixture drift check compares exact JSON and Luau bytes.

## G2d integration boundary

G2d provides `RuntimeSessionV03`, generation tokens, behavior connections, player progress,
spawn/checkpoint placement, hazard and finish handling, stale-callback isolation, and the opt-in
activation coordinator. It integrates this root primitive with the fuller session transaction in
the G2 ADR. The current `0.2` default remains unchanged until the required manual Roblox Studio gate
and a later separately reviewed cutover pass; G2c alone still enables none of those behaviors.
