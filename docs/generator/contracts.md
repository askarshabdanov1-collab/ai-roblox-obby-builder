# G0 generator contract reference

Schema version `0.1` and the JSON Schema at `packages/obby-generator-contracts/schemas/generator-contracts.schema.json` define the structural boundary. Cross-field and graph rules live in the semantic validator. `npm run generator:contracts:check` compiles the Draft 2020-12 schema and checks its generated schema fingerprint without modifying files.

The graph contains `GenerationRequest`, `NormalizedGenerationRequest`, `GeneratorConfiguration`, `MechanicDefinition`, `MechanicCatalog`, `ObbySpec`, `StageSpec`, `RouteSpec`, `RouteNodeSpec`, `RouteTransitionSpec`, `CheckpointSpec`, `HazardSpec`, `FinishSpec`, `DifficultyPlan`, `DifficultyBand`, `MechanicIntent`, `AssetIntent`, `VisualStyleIntent`, `ProgressionIntent`, `RetentionIntent`, `GenerationLimitation`, `GenerationFinding`, and `GenerationBundle`.

Every produced semantic record carries `schemaVersion`, a type-specific stable ID, and a type-specific content hash. `GenerationRequest` can supply `generationRequestHash`; otherwise normalization calculates it. `NormalizedGenerationRequest`, configuration, catalog/definitions, every nested ObbySpec record, ObbySpec, and bundle always carry hashes. ObbySpec also carries `seedIdentity`, which binds the explicit seed to normalized-request, configuration, catalog, and PRNG identities. Hash result fields exclude themselves. Ordered route/stage sequences stay ordered; semantic sets use Unicode-scalar ordering.

Producers and consumers are deliberately narrow:

- The CLI/user produces `GenerationRequest`; normalization consumes it.
- Normalization produces `NormalizedGenerationRequest`; the reference planner and G1 consume it indirectly through ObbySpec identity.
- Repository configuration and mechanic catalog constrain the planner and validator.
- The planner produces stages, difficulty, mechanic intents, route, checkpoints, hazards, finish, visual/assets, progression/retention, findings, and limitations.
- Full graph validators require the exact catalog, generator configuration, and normalized request authority; omitting context is an error.
- The graph validator consumes the complete ObbySpec and bundle before publication and closes bidirectional stage/mechanic, route/checkpoint, hazard, asset, and visual references.
- G1 consumes only validated ObbySpec, never request prose.

The committed fixtures under `examples/generator` contain real hashes plus same-seed, different-seed, and implicit/explicit-default evidence with content-addressed output names. Negative fixtures map to exact typed errors. `npm run generator:fixtures:check` recomputes artifacts in memory, verifies equality/controlled-variation relations without rewriting, and rejects `ZERO_HASH`.
