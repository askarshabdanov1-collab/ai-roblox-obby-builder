# G0 generator contract reference

Schema version `0.1` and the JSON Schema at `packages/obby-generator-contracts/schemas/generator-contracts.schema.json` define the structural boundary. Cross-field and graph rules live in the semantic validator. `npm run generator:contracts:check` compiles the Draft 2020-12 schema and checks its generated schema fingerprint without modifying files.

The graph contains `GenerationRequest`, `NormalizedGenerationRequest`, `GeneratorConfiguration`, `MechanicDefinition`, `MechanicCatalog`, `ObbySpec`, `StageSpec`, `RouteSpec`, `RouteNodeSpec`, `RouteTransitionSpec`, `CheckpointSpec`, `HazardSpec`, `FinishSpec`, `DifficultyPlan`, `DifficultyBand`, `MechanicIntent`, `AssetIntent`, `VisualStyleIntent`, `ProgressionIntent`, `RetentionIntent`, `GenerationLimitation`, `GenerationFinding`, and `GenerationBundle`.

Every produced semantic record carries `schemaVersion`, a type-specific stable ID, and a type-specific content hash. `GenerationRequest` can supply `generationRequestHash`; otherwise normalization calculates it. `NormalizedGenerationRequest`, configuration, catalog/definitions, every nested ObbySpec record, ObbySpec, and bundle always carry hashes. ObbySpec also carries `seedIdentity`, which binds the explicit seed to normalized-request, configuration, catalog, and PRNG identities. Hash result fields exclude themselves. The GeneratorConfiguration semantic preimage additionally excludes `limits.maxWorkUnits`, which is execution admission metadata rather than game-generation identity. Ordered route/stage sequences stay ordered; semantic sets use Unicode-scalar ordering.

Producers and consumers are deliberately narrow:

- The CLI/user produces `GenerationRequest`; normalization consumes it.
- Normalization produces `NormalizedGenerationRequest`; the reference planner and G1 consume it indirectly through ObbySpec identity.
- Repository configuration and mechanic catalog constrain the planner and validator.
- The planner produces stages, difficulty, mechanic intents, route, checkpoints, hazards, finish, visual/assets, progression/retention, findings, and limitations.
- Full graph validators require the exact catalog, generator configuration, and normalized request authority; omitting context is an error.
- The graph validator consumes the complete ObbySpec and bundle before publication and closes bidirectional stage/mechanic, route/checkpoint, hazard, asset, and visual references.
- G1 consumes only validated ObbySpec, never request prose.

Generation work admission is a separate descriptor-based structural boundary. It accepts only non-Proxy plain records and a standard plain mechanics array, reads only own data descriptors for effective stage count, mechanic-array length, and configured maximum, and reserves `4000 + 120S + 100M + 4SM`. No getter, inherited accessor, Proxy trap, iterator, coercion hook, or mechanic element is invoked. After successful reservation, the complete input graph is copied into plain internal snapshots by descriptor inspection before semantic processing. Successful admission exposes required/admitted/available/unused accounting only through the execution test seam; those values never enter semantic payloads.

CLI publication builds a complete synced private directory, acquires a separate private destination-name lock, revalidates lock/parent identity and final absence, and atomically renames the complete directory into the public content-addressed destination. The public path is absent until that commit and is never used as a claim. `output-conflict` identifies existing or late-created legitimate destinations or a conforming competing publisher; `path-safety` identifies reparse or replaced identities; `output-publication` covers sanitized commit failures; and `cleanup-failed` covers sanitized cleanup failure. No error includes native paths, private names, identity values, or operating-system messages.

The committed fixtures under `examples/generator` contain real hashes plus same-seed, different-seed, and implicit/explicit-default evidence with content-addressed output names. Negative fixtures map to exact typed errors. `npm run generator:fixtures:check` recomputes artifacts in memory, verifies equality/controlled-variation relations without rewriting, and rejects `ZERO_HASH`.
