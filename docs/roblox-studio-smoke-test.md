# Roblox Studio Phase 0 smoke test

This is an engine-dependent verification procedure. Lune covers the pure runtime policies; this
procedure verifies real Roblox Instances, player spawning, touches, character respawning, and scene
replacement. Do not report it as passed unless every observation below was made in Studio.

## Prepare the smoke place

1. Run `rokit install`, `npm ci`, `npm run fixtures:check`, and `npm run roblox:build`.
2. Open `build/Phase0Smoke.rbxlx` in Roblox Studio.
3. In **Test**, set **Players** to `2`, then choose **Start**.
4. Wait for server output:
   `[Phase 0 smoke setup] Static engine checks passed; complete the documented two-player test.`
5. Confirm `Workspace:GetAttribute("Phase0SmokeReady")` is `true`.

The bootstrap assertions check real Instance classes, CFrame/property application, exact
character-placement center and offset, explicit 0°/90°/180°/270° facing, route-aware spawn and
checkpoint facing, automatic facing changes after route geometry changes, explicit-yaw fallback
for a final checkpoint, all supported native shapes, non-colliding decoration, exactly one eligible
`SpawnLocation`, checkpoint construction as a `Part`, owned-root replacement, unowned-root refusal,
preservation of a previous scene on an injected staging failure, and staging-folder destruction.

## Two-player observations

Use the two client windows and record the result of each step.

1. Confirm player A initially appears on `Spawn` with HumanoidRootPart position exactly
   `(0, 6.5, 0)`: the spawn's horizontal center and three studs above its top surface. Confirm its
   LookVector is `(0, 0, 1)`, facing the center of the first safe-route object,
   `JumpPlatform01`.
2. Confirm player B has the same exact initial position and facing direction; neither player may
   appear at `Checkpoint01`.
3. Move player A onto `Checkpoint01`. Confirm player A receives
   `ObbyCheckpointOrder = 1`; player B must have no such attribute.
4. Reset both characters in the same test session.
5. Confirm player A's HumanoidRootPart relocates exactly to `(0, 10.5, 31)`, the checkpoint center
   and configured offset, with LookVector `(0, 0, 1)` facing the center of the next safe-route
   object, `WedgeClimb01`. Confirm player B returns exactly to `(0, 6.5, 0)` facing
   `(0, 0, 1)`.
6. Move either player onto `KillFloor`. Confirm the Humanoid reaches `Health = 0` and the character
   respawns according to that player's own checkpoint state.
7. Move player A onto `FinishPlatform`. Confirm
   `ObbyFinishedScene = "brainrot-tower-vertical-slice-scene"`. Touch it repeatedly and confirm the
   value remains stable with no duplicate completion side effect.
8. Confirm server output contains no bootstrap assertion for route-aware orientation, route
   geometry changes, explicit-yaw fallback, owned rebuild, or unowned-root refusal.
9. Confirm server output contains no bootstrap assertion for previous-scene preservation or staging
   cleanup. Then, in the server command bar, run
   `require(game.ReplicatedStorage.ObbyRuntime.Builder).build(require(game.ServerStorage.GeneratedManifests.VerticalSliceManifest), workspace)`.
   Confirm `GeneratedObby` is replaced successfully and remains owned by
   `GeneratedBy = "AIObbyBuilder/0.2"`.

Stop the test and preserve the Studio output plus the observations in the pull-request evidence.
