# ADR 0002: G1 layout contract boundary

- Status: Accepted for G1a
- Date: 2026-07-29
- Scope: contract and design decisions only

## Context

G0 ends at a validated, content-addressed `GenerationBundle` containing an abstract `ObbySpec`.
The existing Phase 0 path starts from PlaceSpec `0.2`, compiles SceneManifest `0.2`, and is consumed
by a Luau runtime that accepts only schema `0.2` and generator `0.2.0`. PlaceSpec `0.2` admits at
most 20 stages and at least one checkpoint, while G0 admits 5 through 50 stages and valid G0 output
can contain no checkpoints. G0 IDs also use the lower-case generator ID grammar while Phase 0
gameplay object IDs use the Pascal ID grammar.

G1a resolves these mismatches without producing geometry, adding mechanic recipes, changing the
compiler, or changing Roblox runtime behavior.

## Decisions

### 1. Public G1 input

The public G1 boundary receives the complete `GenerationBundle` and the exact
`GeneratorConfiguration` and `MechanicCatalog` authorities that validate it. Layout publication
also requires the exact `LayoutConfiguration` and all referenced `MechanicLayoutDefinition`
authorities. G1 consumes the validated `obbySpec` graph inside that bundle. It never interprets
`normalizedRequest.brief` or any other prose.

Passing an uncontextualized `ObbySpec`, omitting an authority, or supplying an authority with the
right ID but different content is invalid. The G1a validator snapshots every input and then invokes
the complete G0 graph validator before validating layout content.

### 2. LayoutSpec compilation path

`LayoutSpec` is a distinct, versioned contract between abstract planning and Roblox compilation.
The intended path is:

```text
validated GenerationBundle + exact authorities
                         |
                         v
             future G1 layout producer
                         |
                         v
             validated LayoutBundle 0.1
                         |
                         v
       future pure LayoutSpec -> PlaceSpec 0.3 projection
                         |
                         v
       generalized compiler -> SceneManifest 0.3
                         |
                         v
              version-aware Luau runtime
```

G1a implements only the contract and validation boundary shown above. It does not implement any
producer or downstream projection.

### 3. Stage support

G1 supports the entire valid G0 range of 5 through 50 stages. It does not truncate or split a
21–50 stage request to fit PlaceSpec `0.2`. LayoutSpec therefore admits 5–50 ordered stages. The
future PlaceSpec/SceneManifest `0.3` path must carry the same range before a G1 layout can be
published to Roblox.

### 4. Zero checkpoints

Zero checkpoints are represented by no checkpoint source records, no `checkpointObjectId` on any
layout stage, and no gameplay object with role `checkpoint`. There is no sentinel, synthetic
checkpoint, or implicit fallback checkpoint. This preserves valid G0 behavior such as a five-stage
plan with checkpoint frequency five.

### 5. Phase 0 compatibility

PlaceSpec `0.2`, SceneManifest `0.2`, compiler `0.2`, generated vertical-slice artifacts, and the
Luau `0.2` runtime remain unchanged and byte compatible. G1 will introduce PlaceSpec and
SceneManifest `0.3` beside the legacy contract; it will not silently widen `0.2`. Runtime support
for `0.3` is a separate, explicitly reviewed change after the downstream schema exists. Until then,
G1 layout output is not eligible for runtime publication.

### 6. Derived IDs

`source-ordinal-pascal-v1` is the deterministic derived-ID policy. It never copies arbitrary G0
text IDs into a Phase 0 gameplay ID. G0 identities remain explicit source references.

| Record                     | Derived ID                                                                     |
| -------------------------- | ------------------------------------------------------------------------------ |
| LayoutSpec                 | `layout-spec-` + first 16 lowercase hex characters of `obbySpecHash`           |
| LayoutBundle               | `layout-bundle-` + first 16 lowercase hex characters of `generationBundleHash` |
| Global route               | `layout-route-` + first 16 lowercase hex characters of source `routeHash`      |
| Layout stage               | `layout-stage-SS`, with the 1-based stage ordinal padded to two digits         |
| Initial spawn              | `Spawn`                                                                        |
| Ordinary safe-route object | `StageSSRouteRRR`, with stage and within-stage route order                     |
| Checkpoint                 | `CheckpointCCC`, with the 1-based authoritative checkpoint-list ordinal        |
| Stage hazard               | `StageSSHazardHHH`, with within-stage authoritative hazard order               |
| Finish                     | `Finish`                                                                       |
| Decorative zone            | `layout-zone-ZZZ`, with the 1-based zone-list ordinal                          |

The fixed widths cover the bounded contract ranges and are part of the policy version. Changing a
mapping requires a new policy identifier and new layout contract version.

### 7. Numeric recipe authority

There are exactly two semantic numeric authorities:

- `LayoutConfiguration.numericParameters` owns global packing, character placement, fall-void,
  precision, tolerance, and global limit values;
- each `MechanicLayoutDefinition.difficultyProfiles[].parameters` owns mechanic-specific sizes,
  gaps, angles, and counts for a difficulty level.

The six global parameters required by the G1 contract are `character-root-offset`,
`fall-void-depth`, `fall-void-margin`, `packing-cell-depth`, `packing-cell-width`, and
`packing-columns`. Parameter IDs and units are validated. A future producer may not use an
undeclared numeric recipe constant. `limits.maxWorkUnits` is execution-only admission metadata and
is deliberately excluded from semantic configuration identity; all other numeric fields are
content-addressed. G1a commits no production mechanic definition instances or recipe values.

### 8. Route packing

`bounded-serpentine-grid-v1` is authoritative. It consumes stages in G0 order, consumes route
objects in within-stage order, fills a bounded grid row, reverses horizontal traversal on each new
row, and applies the declared packing parameters. It must not search, backtrack, reorder stages,
or derive a route from object construction order. The global safe route is the concatenation of
each stage's ordered route objects followed by `Finish`. Hazards and decorative zones are never
route members.

This ADR selects the strategy and its authorities. The geometry algorithm is deferred to G1b.

### 9. Fall-void semantics

A G0 `fall-void` hazard will map to a finite, stage-local native-Part catch/kill volume below the
safe route. Its depth and horizontal margin come from `LayoutConfiguration`; its
`sourceHazardId` remains attached. It is a native gameplay object, may receive touch events, and
is never part of the safe route. It is not an infinite world rule, Terrain replacement, decorative
mesh, or runtime-generated implicit floor. G1a validates the source binding but creates no volume.

### 10. Indeterminate reachability

Every required safe-route transition must be `feasible-under-model` under the exact controller
profile referenced by `LayoutConfiguration`. `indeterminate` blocks `LayoutBundle` publication;
it cannot be downgraded by a profile or accepted as a warning. A blocked attempt may emit a typed
`reachability-indeterminate` limitation in an unpublished diagnostic candidate, but a complete
validated bundle cannot contain that limitation. LayoutSpec carries one ordered assessment record
from `Spawn` through every global safe-route object, binds the configured controller profile and
the existing `e1-coarse-surface-transition-v1`/`coarse-transition-classifier` method identities,
and records each normalized transition-input hash. The G1b producer must recompute those results;
G1a validates their contract and reference closure only. This is model-relative evidence, not a
claim of universal physical possibility or impossibility.

## Consequences

- G1a adds a contract-only package and no layout producer.
- G1b must provide reviewed, content-addressed mechanic definitions before generating layouts.
- G1 output cannot enter the existing `0.2` Roblox path.
- Supporting 21–50 stages and zero checkpoints downstream requires explicit `0.3` contracts and
  runtime work in later scoped changes.
- Authority changes invalidate the affected content hashes and fail closed instead of silently
  changing an existing layout.
