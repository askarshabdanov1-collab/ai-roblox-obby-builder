# G2d SceneManifest 0.3 gameplay session

G2d implements the opt-in SceneManifest `0.3` gameplay-session library. It composes the G2b
admission boundary and G2c candidate builder without changing `ObbyBootstrap.server.luau`, the
default Rojo manifest, or active SceneManifest `0.2` behavior. No production server script selects
`BuilderV03`; manual Roblox Studio acceptance remains a G2e gate.

## Implemented modules

- `RuntimeSessionV03.luau` owns one admitted manifest hash, one runtime generation token, the
  candidate lookup tables, explicit gameplay connections, and per-player checkpoint, finish,
  hazard-debounce, and pending-placement state.
- `BuilderV03.luau` is an opt-in library coordinator for G2b admission, G2c construction, session
  preparation, root publication, session activation, replacement cleanup, and one server-level
  Players/CharacterAdded coordinator.
- `SceneBuilderCoreV03.luau` supports a session-aware root commit and returns a bounded deferred
  cleanup receipt. Its original G2c root-only call remains compatible.

The modules perform no bootstrap version selection, filesystem or network access, dynamic-mechanic
execution, or external-asset loading.

## Runtime session lifecycle and identity

A session starts `inactive`, may be prepared once, activates once only after its root, manifest
hash, generation token, and session are the current pointer, and ends `disposed`. Disposal is
idempotent and clears all connections and internal player state. A generation token has the
deterministic runtime-only form `g2d-generation-v1:<monotonic integer>`; it never contributes to a
manifest, contract, or artifact hash.

Every asynchronous mutation verifies the current session pointer, generation token, manifest hash,
owned root, root identity attributes, and the relevant object or player/character identity.
Disconnection is cleanup, while these comparisons are the stale-callback security boundary.

## Gameplay behavior

The manifest gameplay Part selected by `navigation.spawnObjectId` is the initial placement
authority. The helper SpawnLocation remains invisible and non-authoritative. Initial and checkpoint
placement share `CharacterPlacement`: exact X/Z center, declared deterministic vertical offset,
horizontal facing toward the next safe-route object, and explicit yaw fallback. Each root lookup
uses one fixed 10-second maximum and repeats all generation and character checks before applying
`HumanoidRootPart.CFrame`.

Only admitted objects with matching explicit role/behavior pairs receive `Touched` connections:

- checkpoints store object ID and order, advance only, and re-resolve the Part from the current
  session for respawn;
- touch-kill hazards set only the resolved current character's Humanoid health and debounce by
  player, object, and character within the session; and
- finish records completion once per player and manifest hash.

Touched delivery is empirical Roblox engine behavior, not proof that every geometric contact or
traversal will produce a callback.

Visible state uses the versioned attributes `ObbyV03CheckpointOrder` and
`ObbyV03FinishedManifestHash`. Same-manifest replacement transfers validated ID-based progress but
never Parts or connections. A different manifest clears visible and internal active progress before
new placement. Player removal disconnects its coordinator connection, removes retained player
references, and clears only that player's session state.

## Replacement and failure behavior

The builder completes admission, planning, off-Workspace construction, all gameplay connection
preparation, progress validation, and the final current-pointer recheck before commit. The no-yield
commit publishes the candidate and installs its session/token pointer while the old scene is
quarantined. The old session is then invalidated, the new session is activated against the current
root, old callbacks/state are disposed, and only then is the retired root destroyed.

Every injected failure before the pointer switch preserves the previous complete root and active
session and destroys the candidate. Partial connection preparation is disconnected. After the
pointer switch, the new scene remains authoritative; retired-root cleanup failure is returned as a
bounded warning and never reactivates the old session. This is application-level ordering and does
not claim an engine-level atomic transaction or exact scheduler behavior.

## Evidence, limits, and G2e handoff

Luau fakes cover the representative, replacement, zero-checkpoint, and 50-stage fixtures; two
players; same- and different-manifest replacement; delayed and missing roots; every pre-pointer
commit boundary; stale placement/checkpoint/hazard/finish callbacks; partial connection failure;
and disposal. Connections are allocated only for explicit checkpoint, touch-kill, and finish
objects and therefore never exceed the admitted gameplay-object count. All waits and contract-sized
loops are bounded.

G2e owns the required manual Roblox Studio smoke and two-client execution, environment and raw
performance evidence, and any resulting runtime fixes. G2d does not execute that manual gate and
does not make SceneManifest `0.3` the default. A later separately reviewed cutover remains required;
until then `0.2` is the rollback-safe active path.
