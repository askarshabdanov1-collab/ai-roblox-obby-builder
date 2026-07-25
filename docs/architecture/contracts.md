# Contracts

JSON Schema Draft 2020-12 files under `packages/contracts/schemas/` are the sole structural source
of truth. Ajv runs in strict, all-errors, strict-number mode. TypeScript interfaces are generated
from those schemas.

Semantic validation is a separate, named layer for rules JSON Schema cannot express cleanly:
unique IDs and order, contiguous stages/checkpoints, budget enforcement, route membership and
reachability, exactly one finish, Roblox class/shape compatibility, physics policy, world bounds,
and manifest hash integrity.

`PlaceSpec.coarseReachability` is deliberately an axis-aligned surface heuristic, not a Roblox
physics simulation. It records the immutable model (`axis-aligned-surfaces-v1`), default R15 avatar
assumption, movement values, maximum horizontal gap, maximum upward rise, and maximum downward
drop. Rotation and wedge shape are retained in the contract and runtime, but this Phase 0 heuristic
uses their unrotated axis-aligned size.

`SceneManifest.navigation` preserves ordered stages, ordered safe-route IDs at stage and global
scope, a unique contiguous route entry for every safe gameplay object, and the same coarse movement
assumptions. Kill hazards remain outside the safe route. Gameplay objects also retain their semantic
color role.

`characterPlacement` defines `humanoid-root-part-cframe-v1`, a root-center vertical offset, and an
orientation policy. `face-next-safe-route-object` derives yaw from the source center to the next
global safe-route object while ignoring height; `explicit-yaw` always uses the source object's
declared yaw. Route-aware placement falls back to the declared yaw when no next route object exists
or the horizontal direction is invalid or too small. Spawn and checkpoint surfaces may use yaw but
cannot pitch or roll, keeping the vertical non-intersection guarantee well-defined for the default
R15 avatar.

Contract `0.2` is deliberately incompatible with bootstrap `0.1`. No automatic migration is
provided. A future change that alters accepted structure or semantics must update the schema
version, generator compatibility, fixtures, negative tests, runtime validation, and documentation.
