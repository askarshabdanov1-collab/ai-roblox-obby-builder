# Roblox build

`npm run roblox:build` produces `build/AIObbyBuilder.rbxlx` and a Rojo sourcemap from
`roblox/default.project.json`.

The generated manifest is server-only. `ObbyBootstrap.server.luau` passes it to the builder, which:

1. validates the runtime and generator versions and manifest policy;
2. creates a deterministic build plan;
3. stages native instances without changing Workspace;
4. connects checkpoint, kill, and finish behavior;
5. verifies ownership of `Workspace.GeneratedObby`;
6. atomically replaces the generated children.

Spawn and checkpoint respawn targets are native `SpawnLocation` instances. Blocks, balls, and
cylinders use `Part`; wedges use `WedgePart`. Rotations are applied as XYZ Euler degrees. Gameplay
objects collide; decorative objects cannot collide or trigger touches.
