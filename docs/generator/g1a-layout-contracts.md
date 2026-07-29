# G1a layout contract reference

## Scope

The structural source is
`packages/obby-layout-contracts/schemas/layout-contracts.schema.json` (JSON Schema Draft 2020-12).
Generated TypeScript declarations and the schema fingerprint are review artifacts under
`packages/obby-layout-contracts/src/generated/`. Cross-field authority, identity, ordering,
reference closure, gameplay ownership, bounds, and publication rules are implemented only in the
named semantic validation layer.

The package contains no geometry producer, packing implementation, production mechanic recipe,
PlaceSpec projection, compiler change, or Roblox runtime change.

## Public contracts

### LayoutConfiguration

The exact global authority for algorithm version, route packing policy, derived-ID policy, units,
precision, numeric parameters, reachability policy, controller profile reference, structural
limits, and work admission. `maxWorkUnits` is the sole execution-only field.

### MechanicLayoutDefinition

The exact authority binding one `g1-static-supported` G0 mechanic definition to the G1 layout
algorithm, allowed native Part shapes, route-object budget, and bounded numeric profiles for
difficulty levels. G1a defines this record shape but deliberately commits no production instances.

### LayoutSpec

A geometry-bearing but Roblox-instance-neutral result containing source authorities, seed identity,
coordinate policy, character placement, world bounds, ordered stages, one global safe route,
an ordered model-relative reachability assessment for every required transition, native gameplay
objects, non-colliding decorative zones, limitations, and findings. All G0 IDs are source
references; derived gameplay IDs use `source-ordinal-pascal-v1`.

### LayoutBundle

The publication envelope binding one LayoutSpec to the exact GenerationBundle,
LayoutConfiguration reference, and complete used MechanicLayoutDefinition reference set. The
authorities themselves are supplied separately to full validation so stale content cannot be
accepted merely because an embedded copy agrees with itself.

## Named hash preimages

All four domains use SHA-256 over UTF-8 evaluator canonical JSON with identity-domain separation.
Objects use canonical key order and finite normalized numbers. No timestamp, request ID, caller,
authentication, transport, retry, session, execution ID, or processing metadata exists in these
semantic records.

| Result field                   | Named preimage                     | Included fields and ordering                                                                                                                                                                                                                                                           | Excluded fields                                           | Equivalence rule                                                                                                       |
| ------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `configurationHash`            | `LayoutConfigurationPreimage`      | Every LayoutConfiguration field except exclusions; `numericParameters` sorted by `parameterId`                                                                                                                                                                                         | `configurationHash`; execution-only `limits.maxWorkUnits` | Configurations differing only in work budget or semantic-set order are equivalent                                      |
| `mechanicLayoutDefinitionHash` | `MechanicLayoutDefinitionPreimage` | Every definition field except its result hash; shapes sorted; profiles sorted by level; parameters sorted by ID                                                                                                                                                                        | `mechanicLayoutDefinitionHash`                            | Equivalent shape/profile/parameter sets have one digest; changing any recipe authority changes it                      |
| `layoutSpecHash`               | `LayoutSpecPreimage`               | All LayoutSpec semantic fields; stages, within-stage route IDs, global route IDs, and reachability transitions remain ordered; definition hashes, object inventory, zones, hazard/zone reference sets, asset-reference sets, findings, limitations, and related-ID sets are normalized | `layoutSpecHash`                                          | Semantic-set permutations are equivalent; route, stage, or transition order changes are not                            |
| `layoutBundleHash`             | `LayoutBundlePreimage`             | All LayoutBundle fields except its result hash; definition references sorted by definition ID                                                                                                                                                                                          | `layoutBundleHash`                                        | Reference-set permutations are equivalent; any source, configuration, definition, or LayoutSpec identity change is not |

Each hash helper accepts either a hash-free preimage or a final record and removes its own result
field before canonicalization. Self-hash variation therefore cannot change canonical preimage bytes
or the digest. Hashes identify calculation content, not executions.

## Full graph validation

`assertValidLayoutBundle` requires six inputs: candidate LayoutBundle, source GenerationBundle,
exact G0 GeneratorConfiguration, exact G0 MechanicCatalog, exact LayoutConfiguration, and all exact
used MechanicLayoutDefinitions. It:

1. takes immutable-compatible snapshots;
2. validates the complete G0 graph under its exact authorities;
3. runs strict structural validation and recomputes all four G1 hashes;
4. rejects stale configuration, catalog, mechanic-definition, source, and seed bindings;
5. closes every stage, route-node, mechanic-intent, checkpoint, hazard, finish, visual, asset,
   object, zone, and safe-route reference;
6. enforces ordered stage and route semantics, derived IDs, native gameplay ownership, collision,
   touch behavior, spawn/checkpoint pitch-roll prohibition, and declared bounds;
7. closes the ordered Spawn-to-Finish reachability records and binds their model and controller
   profile authority;
8. rejects an indeterminate required-route limitation from a publishable bundle.

The validator returns a snapshot rather than caller-owned mutable data. Structural schema errors,
content hash mismatches, stale authorities, invalid references, duplicate IDs, unsupported
mechanics, and invariants have distinct typed codes.

## Migration strategy

1. Keep the Phase 0 `0.2` path and its fixtures frozen as the compatibility oracle.
2. Add reviewed production MechanicLayoutDefinition records and a default LayoutConfiguration in
   a focused G1b change; generation must consume these exact authorities.
3. Implement a pure LayoutBundle producer only after its definition set and reachability seam are
   approved. It publishes nothing when any required transition is indeterminate.
4. Introduce PlaceSpec and SceneManifest `0.3` schemas side by side with `0.2`, including the full
   source-reference graph, 5–50 stages, and zero-checkpoint semantics.
5. Add a pure LayoutSpec-to-PlaceSpec `0.3` projection and generalize compilation with explicit
   version dispatch. Never coerce LayoutSpec into PlaceSpec `0.2`.
6. Add Luau `0.3` validation and runtime support only after generated transport and cross-language
   fixtures pass. Keep `0.2` acceptance until its removal has a separate ADR.
7. Switch publication to `0.3` only after Node, Luau, and Studio smoke evidence is complete.

## Rollback strategy

- G1a can be reverted by removing the layout-contract package, its scripts, aliases, documentation,
  and tests; no current producer or consumer depends on it.
- During later dual-version work, disable the `0.3` dispatch/publication path and continue serving
  the unchanged `0.2` vertical slice. Existing `0.2` artifacts do not require regeneration.
- Content-addressed LayoutBundles are immutable. A bad configuration or definition is withdrawn by
  ceasing publication of its hash and introducing a newly versioned authority; it is never edited
  in place.
- A failed `0.3` rollout must not down-convert a G1 layout. It returns a typed unsupported-version
  or publication error and leaves the current Roblox scene unchanged.

## Validation

```text
npm run layout:contracts:check
npm run layout:contracts:test
npm run build:smoke
npm run validate
git diff --check origin/main...HEAD
git status --short --branch
```

The tests cover reproducible schema identity; self-exclusion for all four hashes; stale exact
authorities; reference closure; 20, 21, and 50 stages; zero checkpoints; and byte-exact legacy
PlaceSpec/SceneManifest `0.2` compilation.
