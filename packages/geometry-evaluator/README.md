# `@obby/geometry-evaluator`

Deterministic Roblox-oriented geometry normalization for Phase E1a. It accepts validated Block,
Ball, Cylinder, and Wedge inputs in studs and returns normalized rotations, oriented-box
foundations, conservative axis-aligned bounds, top-surface summaries, collision authority, and
transition gap/rise/drop inputs.

Native gameplay Parts remain authoritative. Decorative geometry is preserved as decorative and is
rejected as a gameplay transition endpoint.

The package deliberately emits no route, reachability, physics, feasibility, checkpoint, hazard,
softlock, or scoring verdict. Those decisions belong to later reviewed phases.
