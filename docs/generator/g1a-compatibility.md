# G1a compatibility matrix

G1a adds a contract boundary only. “Accepted now” means an existing validator accepts the record;
it does not mean a layout producer or Roblox runtime exists.

| Contract                 | Current version                   | G1a relationship                                                                               | Accepted now                                                 | Intended downstream relationship                                |
| ------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| GenerationBundle         | `0.1`                             | Required public source envelope; validated with exact G0 configuration and catalog             | Yes, by the G0 validator and then the layout graph validator | Remains the authoritative G1 input                              |
| ObbySpec                 | `0.1`                             | Consumed only through a validated GenerationBundle; IDs retained as source references          | Yes                                                          | Remains abstract and geometry-free                              |
| LayoutConfiguration      | `0.1`                             | New exact global numeric, packing, identity, reachability, and limit authority                 | Yes                                                          | Future G1 producer input                                        |
| MechanicLayoutDefinition | `0.1`                             | New exact per-mechanic numeric authority shape; no production definitions are committed in G1a | Yes                                                          | Reviewed definition instances arrive before generation          |
| LayoutSpec               | `0.1`                             | New content-addressed layout result shape                                                      | Yes, for externally constructed contract fixtures            | Future pure projection source; no producer in G1a               |
| LayoutBundle             | `0.1`                             | New source/configuration/definition binding envelope                                           | Yes, for externally constructed contract fixtures            | Future G1 publication unit                                      |
| PlaceSpec                | `0.2`                             | Legacy path only; max 20 stages and at least one checkpoint                                    | Unchanged                                                    | Future `0.3` must accept the full G1 range and zero checkpoints |
| SceneManifest            | `0.2`                             | Legacy compiler output only                                                                    | Unchanged                                                    | Future `0.3` carries projected G1 provenance and full range     |
| Luau runtime schema      | manifest `0.2`, generator `0.2.0` | Legacy generated vertical slice only                                                           | Unchanged                                                    | A later version-aware runtime change may add manifest `0.3`     |

## Compatibility rules

- There is no implicit conversion from LayoutSpec `0.1` to PlaceSpec `0.2`.
- A G1 layout with any stage count is not publishable to the current Luau runtime.
- Existing PlaceSpec/SceneManifest `0.2` inputs, hashes, compiler output, generated Luau transport,
  and runtime semantics remain authoritative for the vertical slice.
- A future `0.3` migration must be additive while `0.2` remains supported, and must include schema,
  compiler, fixture, transport, Luau validation, Studio smoke, and rollback coverage in one
  coordinated compatibility change.
- Version selection must be explicit. A consumer must reject an unsupported version rather than
  attempting best-effort coercion.

## Known incompatibilities requiring `0.3`

| Concern         | G0/G1 requirement                                                               | Phase 0 `0.2` constraint                                                    |
| --------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Stage count     | 5–50                                                                            | maximum 20                                                                  |
| Checkpoints     | zero is valid                                                                   | at least one checkpoint ID                                                  |
| IDs             | preserve G0 IDs as source references and use derived gameplay IDs               | no G0/G1 source-reference graph                                             |
| Provenance      | bind GenerationBundle, ObbySpec, layout configuration, and mechanic definitions | PlaceSpec provenance and manifest source fields do not carry the full graph |
| Fall void       | explicit finite native kill volume bound to source hazard                       | no source hazard semantics                                                  |
| Layout contract | LayoutSpec and LayoutBundle `0.1`                                               | no layout input boundary                                                    |
