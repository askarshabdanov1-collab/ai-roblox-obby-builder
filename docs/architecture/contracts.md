# Contracts

JSON Schema Draft 2020-12 files under `packages/contracts/schemas/` are the sole structural source
of truth. Ajv runs in strict, all-errors, strict-number mode. TypeScript interfaces are generated
from those schemas.

Semantic validation is a separate, named layer for rules JSON Schema cannot express cleanly:
unique IDs and order, contiguous stages/checkpoints, budget enforcement, route membership and
reachability, exactly one finish, Roblox class/shape compatibility, physics policy, world bounds,
and manifest hash integrity.

Contract `0.2` is deliberately incompatible with bootstrap `0.1`. No automatic migration is
provided. A future change that alters accepted structure or semantics must update the schema
version, generator compatibility, fixtures, negative tests, runtime validation, and documentation.
