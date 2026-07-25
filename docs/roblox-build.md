# Roblox build

`npm run roblox:build` produces `build/AIObbyBuilder.rbxlx`, the Studio-only
`build/Phase0Smoke.rbxlx`, and a Rojo sourcemap.

The generated manifest is server-only. `ObbyBootstrap.server.luau` passes it to the builder, which:

1. validates the runtime and generator versions and manifest policy;
2. creates a deterministic build plan;
3. stages native instances without changing Workspace;
4. connects checkpoint, kill, and finish behavior;
5. verifies ownership of `Workspace.GeneratedObby`;
6. atomically replaces the generated children.

Only the order-zero start is a native, enabled `SpawnLocation`. Checkpoints are ordinary native
`Part` objects and store progress per player; `CharacterAdded` explicitly relocates only players
who activated a checkpoint in the active scene. Blocks, balls, and cylinders use `Part`; wedges use
`WedgePart`. Rotations are applied as XYZ Euler degrees. Gameplay objects collide; decorative
objects cannot collide or trigger touches. Hazards set Humanoid health to zero, and finish state is
recorded once per player and scene.

Initial spawn and checkpoint respawn both set HumanoidRootPart CFrame explicitly. Placement uses the
object's exact horizontal center, its top surface plus `characterPlacement.verticalOffset`, and the
declared orientation. A generation guard prevents delayed callbacks from an older build from moving
a character into a replacement scene. Checkpoint targets are keyed by `manifestHash`, so progress
from a different scene revision cannot leak into the active build.

The engine-dependent procedure is in `docs/roblox-studio-smoke-test.md`.
