# G1b deterministic native-Part layout engine

## Scope and boundary

`packages/obby-layout-engine` is a pure in-memory producer. It consumes a complete validated G0
`GenerationBundle`, the exact G0 configuration and catalog authorities, a G1a
`LayoutConfiguration`, and the used `MechanicLayoutDefinition` authorities. It returns a complete
G1a `LayoutBundle` only after full graph validation.

G1b does not publish files, change either CLI, project to PlaceSpec or SceneManifest, invoke the
compiler or emitter, create Roblox instances, or provide G1c/G1d behavior. Fixture writers under
`tools/` are validation tooling and are not called by the engine.

## Immutable admission boundary

All caller inputs are copied with the G0 descriptor-safe plain-data snapshot helper. Work is
admitted from that one snapshot before callbacks, semantic validation, recipe expansion,
reachability classification, or serialization. An underfunded request throws
`maximum-work-units`; no admitted callback is invoked.

The G1b work estimate is:

```text
6000 + 240S + 120D + 80H + 12A + 8SD
```

where `S` is source stages, `D` is supplied mechanic definitions, `H` is hazards, and `A` is asset
intents. With the G0/G1a contract maxima (`S=50`, `D=9`, `H=50`, `A=128`), the estimate is 28,216
units. The reference authority admits 100,000 units. Maximum output is also bounded by 501 gameplay
objects, 128 zones, 2,048 studs per world-bound coordinate, a 256-stud part size, and 4 MiB of
canonical LayoutBundle bytes.

## Packing, identities, and seed domains

`bounded-serpentine-grid-v1` assigns one cell to each source stage and one following cell to the
finish. Rows fill in source-stage order and alternate horizontal direction. Objects within a stage
stay in recipe order. The global safe route is the ordered concatenation of stage route objects and
`Finish`; hazards and decorative zones never enter it.

The engine uses the G1a `source-ordinal-pascal-v1` IDs without construction-order discovery. Every
stage, mechanic intent, checkpoint, hazard, finish, asset, visual-style, and route-node reference
is copied from the validated G0 graph and checked again by `assertValidLayoutBundle`.

Randomness uses `g1b-layout-domain-v1`, SHA-256, the G0 seed identity, semantic layout
configuration hash, the scalar-sorted set of used definition hashes, and one explicit domain:

- `stage:SS:<definition-id>:recipe`;
- `stage:SS:hazard:HHH`;
- `stage:SS:decoration`;
- `finish`.

A new G0 seed may change the source graph's selected mechanic authorities. G1b preserves that new
graph exactly; within it, domain randomness may also change recipe mirroring, stage-local hazard
side, decorative-zone side, and all dependent semantic hashes. It does not independently reorder
stages or route objects, change derived ordinal IDs, detach output objects from their current G0
source references, or escape configured limits. Execution budget changes are excluded from
semantic configuration identity and cannot change output bytes.

## Versioned native-Part recipes

Every G0 mechanic currently marked `g1-static-supported` is bound to one `1.0.0` recipe and one
content-addressed definition. All gameplay geometry is an anchored native `Block`; decoration is a
non-colliding zone with native-Part fallback authority.

| G0 mechanic           | Recipe ID                            | Route behavior                                                                |
| --------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| `static-jumps`        | `native-part-static-jumps-v1`        | three bounded jump platforms                                                  |
| `narrow-platforms`    | `native-part-narrow-platforms-v1`    | three reduced-width platforms                                                 |
| `height-changes`      | `native-part-height-changes-v1`      | three platforms with a bounded vertical midpoint                              |
| `turning-jumps`       | `native-part-turning-jumps-v1`       | three mirrored lateral/yaw platforms                                          |
| `stepping-stones`     | `native-part-stepping-stones-v1`     | three compact mirrored stepping stones                                        |
| `balance-beam`        | `native-part-balance-beam-v1`        | three elongated narrow platforms                                              |
| `hazard-avoidance`    | `native-part-hazard-avoidance-v1`    | three laterally varied safe platforms plus source-bound hazards               |
| `checkpoint-recovery` | `native-part-checkpoint-recovery-v1` | three broad platforms; the final object is the source checkpoint when present |
| `finish-approach`     | `native-part-finish-approach-v1`     | one terminal finish platform                                                  |

Mechanic dimensions, counts, route-span ratio, lateral/vertical amplitude, and yaw come only from
the matching difficulty profile. Global packing, spawn, hazard, fall-void, decoration, character,
bounds, tolerance, precision, and limit values come only from `LayoutConfiguration`.

Fall voids are finite stage-local non-colliding touch volumes below the route. Every transition
from `Spawn` through `Finish` is normalized and classified with the exact configured coarse-model
controller authority. `infeasible-under-model` and `indeterminate` both block bundle publication.

## Validation and fixtures

```text
npm run layout:fixtures:check
npm run layout:engine:test
npm run layout:check
npm run validate
```

`examples/layout/` contains generated authorities, the source reference bundle, a complete layout
bundle, semantic-retry twins, and a controlled different-seed result. They are regenerated only by
`npm run layout:fixtures:generate` and checked non-mutatingly.
