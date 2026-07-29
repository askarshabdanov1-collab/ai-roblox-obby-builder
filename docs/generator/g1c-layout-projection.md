# G1c downstream projection and reachability integration

## Boundary and version compatibility

G1c adds a pure, in-memory downstream path without switching publication or Roblox construction:

```text
validated G0 authorities
  + validated LayoutBundle 0.1
  -> @obby/obby-layout-projector
  -> validated PlaceSpec 0.3
  -> compilePlaceSpecV03
  -> validated SceneManifest 0.3
  -> emitManifestModuleV03
  -> validation-only Luau transport
```

PlaceSpec and SceneManifest `0.2`, `compilePlaceSpec`, `emitManifestModule`, the generated vertical
slice, the Phase 0 Luau validator, and all current scene construction remain independent and byte
compatible. G1c does not add version coercion: each validator and compiler entry point accepts only
its declared version. The 0.3 Luau validator is exercised by tests but is not wired into
`ObbyBootstrap`, `SceneBuilderCore`, either CLI, or filesystem publication. That activation remains
future G1d work.

## Projection authority and identities

`projectLayoutBundle` snapshots every input before callbacks, admits bounded work, validates the
complete G0/G1 graph under the supplied generator, catalog, layout-configuration, and used mechanic
definition authorities, and fails closed on stale hashes or references. The projector never reads
the filesystem or network and adds no clock, UUID, host, locale, or unordered-directory data.

The additive downstream IDs are deterministic:

- PlaceSpec: `place-spec-` plus the first 16 hex characters of `layoutSpecHash`;
- SceneManifest: the PlaceSpec ID plus `-scene`;
- all gameplay, stage, route, transition, checkpoint, hazard, finish, and zone IDs remain the exact
  committed G1 IDs;
- all G0 and G1 source identities and hashes remain explicit provenance fields.

`placeSpecHash` and `manifestHash` use domain-separated canonical preimages that exclude their own
result field. Execution work limits and callbacks are not semantic output.

## Geometry and reachability

Every native gameplay primitive is normalized by `@obby/geometry-evaluator`. PlaceSpec 0.3 retains
the normalized geometry hash, exact evaluator AABB, maximum top-surface Y, and coarse surface kind.
For every adjacent edge from `Spawn` through `Finish`, the projector recomputes conservative
horizontal separation, rise, drop, exact supported landing-region spans, surface kinds, classifier
limitations, and normalized-input hash with the exact G1b controller authority.

The recomputed hash must equal the G1b transition binding. A missing endpoint, stale binding,
`infeasible-under-model`, `indeterminate`, or unavailable required measurement blocks output.
Hazards remain native touch/collision-layer objects but never route endpoints. Decorative zones
remain non-colliding intent/fallback regions and are never route endpoints. The result is
model-relative deterministic evidence, not proof of exact Roblox physics.

## Appearance and runtime boundary

The fixed `g1c-native-high-contrast-v1` policy maps the existing G0 palette intent to uppercase
hex colors. Route parts alternate primary and secondary roles; checkpoints and Finish use reward;
hazards use hazard/Neon. This is projection metadata only and introduces no mesh, asset, lighting,
dynamic-mechanic, or runtime behavior.

SceneManifest 0.3 uses native `Part` records and preserves source references, geometry summaries,
reachability evidence, route/stage order, zero-checkpoint empty arrays, world bounds, and decorative
zones. The emitted Luau module is explicitly validation-only in G1c.

## Budgets, validation, and rollback

Projection admission uses:

```text
16 + 6S + 8O + 12R + 4Z + 2D
```

where `S` is stages, `O` gameplay objects, `R` required route transitions, `Z` decorative zones,
and `D` supplied mechanic definitions. N-1 is rejected before the admitted callback; N and N+1
produce identical bytes. Contract maxima remain 50 stages, 501 gameplay objects, 128 zones, 2,048
stud world coordinates, 256-stud part dimensions, and 4 MiB output.

Validation commands are:

```text
npm run layout:projection:fixtures:check
npm run layout:projection:test
npm run layout:projection:check
npm run roblox:test
npm run validate
```

Rollback disables/removes only the explicit 0.3 projector/compiler/emitter/validator path and its
fixtures. The frozen 0.2 path remains the publication fallback; a failed G1c value is never
down-converted to 0.2 and never changes the current Roblox scene.
