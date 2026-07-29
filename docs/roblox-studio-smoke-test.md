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

## Phase 0 recorded result

**PASS — 2026-07-25.** The final two-player Studio run for PR #1 completed this procedure
successfully:

- both players spawned at the exact configured center and height without sharing checkpoint state;
- initial spawn faced `JumpPlatform01`, the first global safe-route object;
- checkpoint respawn faced `WedgeClimb01`, the next global safe-route object;
- changing route geometry changed facing automatically;
- a missing next route target used the declared explicit-yaw fallback;
- delayed callbacks from the replaced scene did not apply stale route data;
- checkpoint, hazard, finish, native-shape, rebuild, ownership, and staging-failure checks passed.

This recorded result is engine evidence for the committed Phase 0 reference slice. It does not turn
the Studio procedure into an automated CI test and must be rerun after relevant runtime, manifest,
or Roblox engine changes.

## G1d generated multi-stage validation smoke

This is a separate, validation-only procedure for
`examples/g1-workflow/reference/scene-manifest-v0.3.luau`. G1d does not implement SceneManifest 0.3
construction, so this procedure must not call the 0.2 builder or claim that the generated 0.3 Obby
is playable.

1. Run `npm ci`, `npm run layout:workflow:fixtures:check`, and `npm run roblox:build`.
2. Open `build/AIObbyBuilder.rbxlx` in Studio. In `ServerStorage`, create a ModuleScript named
   `G1dReferenceManifest` and replace its source with the exact contents of
   `examples/g1-workflow/reference/scene-manifest-v0.3.luau`.
3. In the server Command Bar, run:

   ```lua
   local manifest = require(game.ServerStorage.G1dReferenceManifest)
   local validator = require(game.ReplicatedStorage.ObbyRuntime.ManifestValidatorV03)
   local before = workspace:FindFirstChild("GeneratedObby")
   local valid, reason = validator.validate(manifest)
   assert(valid, reason)
   assert(manifest.schemaVersion == "0.3")
   assert(manifest.layers.gameplay.objects[1].role == "spawn")
   assert(manifest.navigation.stages[1].order == 1)
   assert(manifest.navigation.stages[#manifest.navigation.stages].order == #manifest.navigation.stages)
   assert(manifest.navigation.safeRouteObjectIds[#manifest.navigation.safeRouteObjectIds] == "Finish")
   assert(manifest.layers.gameplay.objects[#manifest.layers.gameplay.objects].role == "finish")
   assert(workspace:FindFirstChild("GeneratedObby") == before)
   print("G1d validation-only smoke passed", manifest.manifestHash)
   ```

4. Inspect `manifest.navigation.routeEntries` and confirm `globalOrder` is exactly `1..N`, each
   entry refers to the matching stage, no gameplay object with role `kill` appears in
   `safeRouteObjectIds`, and the final route entry is `Finish`.
5. Inspect `manifest.navigation.checkpointObjectIds`; confirm its order matches the checkpoint
   objects and their `behavior.checkpointOrder`, with no duplicate ID.
6. Confirm `Workspace.GeneratedObby` was neither created nor replaced. This is the G1d scene
   isolation guarantee: loading and validating the offline transport has no construction side
   effect.

Record Studio version, operating system, the printed manifest hash, every assertion result, and any
Output errors. This G1d Studio procedure has **not been executed for the automated implementation**;
it remains manual engine evidence because Studio is unavailable in the repository validation
environment.
