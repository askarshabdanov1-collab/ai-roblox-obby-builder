# `@obby/geometry-evaluator`

Deterministic Roblox-oriented geometry normalization for Phase E1a. It accepts validated Block,
Ball, Cylinder, and Wedge inputs in studs and returns normalized rotations, oriented-box
foundations, conservative axis-aligned bounds, shape-aware surface descriptors, collision facts,
and conservative transition measurements.

Block output contains an exact transformed top-face plane and polygon. Cylinder output preserves
Roblox's local-X axis and separates circular endcaps from the curved side. Wedge output contains
the transformed slope plane/polygon and its non-sloped faces. Ball output is spherical, with a
center, radius, and top point and no invented planar surface.

Dimensions smaller than `0.000001` studs are rejected before 12-digit normalization. Transition
measurements use a `0.000000001`-stud tolerance and explicitly identify their AABB/envelope method,
conservative approximation, limitations, and `broad-phase-only` applicability. AABB overlap never
claims native surface contact.

Native gameplay Parts remain authoritative. Collision, touch, query, ownership, decoration, and
promotion state are required. Decorative collision/touch is exposed only as an invariant-violation
candidate; decorative or unknown authority is never promoted into a gameplay transition endpoint.
Transition identities must match adjacent forward `safeRouteRef` metadata, and the collection API
rejects duplicate IDs and tuples.

The package deliberately emits no route, reachability, physics, feasibility, checkpoint, hazard,
softlock, or scoring verdict. Those decisions belong to later reviewed phases.
