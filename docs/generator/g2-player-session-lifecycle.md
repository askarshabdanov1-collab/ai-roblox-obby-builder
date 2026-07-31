# G2 player and runtime-session lifecycle

This specification defines SceneManifest `0.3` player behavior. G2d implements it in the opt-in
`RuntimeSessionV03` and `BuilderV03` libraries without changing `PlayerProgress`,
`PlacementController`, `ObbyBootstrap`, or the active `0.2` builder.

## State keys

The semantic keys are:

```text
checkpoint: (player.UserId, manifestHash) -> { checkpointObjectId, checkpointOrder }
finish:     (player.UserId, manifestHash) -> true
```

The runtime accepts any non-zero finite integer returned by the server-owned `Player.UserId`
adapter. Live identities are positive, while local multi-client Studio test identities may be
negative. Zero, fractional, non-finite, and non-player-derived values fail closed.

The runtime generation token is deliberately absent from these keys. It guards callbacks and scene
Instances but does not change same-manifest semantic progress. Stored progress contains IDs and
orders only—never a Part, connection, character, manifest table, or runtime-session reference.

Visible player state uses `ObbyV03CheckpointOrder` and `ObbyV03FinishedManifestHash`. These
attributes expose only the current manifest's checkpoint order and finish identity, not stale state
or internal generation tokens. They are cleared on different-manifest activation and player
removal, and their behavior is covered by G2d tests.

## Initial player and CharacterAdded flow

One version-specific server coordinator binds `Players` once. For each current player it registers
one `CharacterAdded` callback associated with the coordinator, not with an individual scene. When a
character appears:

1. Capture player, character, current manifest hash, current generation token, and current root.
2. Wait for HumanoidRootPart using one fixed bounded timeout.
3. Recheck the player still owns that character and all captured scene values are current.
4. Resolve the player's checkpoint ID from the current session, or the navigation spawn ID when no
   valid checkpoint exists.
5. Resolve the current Part by ID and apply the shared deterministic placement policy.
6. Recheck immediately before setting `HumanoidRootPart.CFrame`.

Missing or delayed roots return a typed/no-op result. They do not retry without a bound and never
fall back to an old scene.

## Checkpoint lifecycle

A checkpoint touch is accepted only when the touching character resolves to the player and the
callback's session, root, manifest hash, generation token, object ID, and connection are current.
Checkpoint order must move forward. Duplicate and lower-order touches are idempotent no-ops.

On acceptance, store the checkpoint ID and order under `(UserId, manifestHash)` and update only that
player's current-version attribute. Respawn resolves the ID again through the current scene lookup.
The checkpoint Part reference is never persisted.

## Finish and hazard lifecycle

Finish state is idempotent under `(UserId, manifestHash)`. Repeated valid touches cannot create a
second completion side effect. A kill touch may set the current character Humanoid health to zero
only after the same current-session checks; it does not directly mutate checkpoint or finish state.

Roblox `Touched` observations are empirical engine behavior. These semantics do not prove that a
touch will occur for every physically conceivable traversal.

## Same-manifest rebuild

A rebuild with the same validated `manifestHash` creates a new runtime generation token and new
Instances but preserves checkpoint and finish records. Before using a preserved checkpoint, the new
session must prove that its ID, role, and order still match admitted navigation data. Failure clears
that checkpoint record and uses spawn; it does not retain an old Part.

Callbacks from the prior generation become invalid as soon as the current pointer changes. Visible
attributes remain stable when their preserved record is valid.

## New-manifest activation

When a different `manifestHash` becomes current:

- old-manifest state is removed from the active in-memory store rather than retained indefinitely;
- current checkpoint and finish attributes are cleared before placement against the new scene;
- every player starts at the new manifest's spawn unless new-manifest progress is established after
  activation; and
- no scene ID or object-name coincidence transfers progress.

Manifest activation is server-global, but progress clearing and placement are performed per player.
One player's callback or failure cannot update another player's state.

## Stale callback rule

Every `CharacterAdded`, delayed root lookup, checkpoint touch, kill touch, finish touch, and deferred
cleanup callback must compare its captured session with the single current pointer. It must also
check the expected player/character and root/object identity relevant to that callback. Any mismatch
returns without placement, health change, progress change, finish change, or visible attribute
change.

Old callback disconnection is cleanup, not the security boundary. Generation-token and pointer
checks are required even when disconnection is expected to succeed.

## Player removal

`PlayerRemoving` disconnects player-owned coordinator callbacks, clears all checkpoint and finish
records for that `UserId`, clears debounce state, and releases character references. Cleanup is
idempotent. A callback already queued for the removed player fails its player/current-character
check and becomes a no-op.

## Implemented isolation tests in G2d

- two players activate different checkpoints without shared state;
- one player's duplicate/debounce state does not suppress the other;
- same-manifest rebuild preserves ID-based progress but rejects old Instances and callbacks;
- new-manifest activation clears both players independently;
- delayed CharacterAdded/root creation from a replaced scene cannot relocate a player;
- stale checkpoint, kill, and finish touches cannot mutate the new session;
- repeated finish is idempotent per player and manifest hash; and
- player removal clears state while another player's state remains intact.
