# G2 runtime fixture and drift ownership

G2 fixtures are deterministic contract evidence, not editable sample levels. Generated files must
never be modified by hand.

## Authoritative transport

The reference source remains:

```text
examples/g1-workflow/reference/scene-manifest-v0.3.luau
```

It is owned by `tools/g1-workflow-fixture-content.ts` and checked with:

```text
npm run layout:workflow:fixtures:check
```

G2b republishes those exact bytes at `roblox/generated/G2ReferenceManifestV03.luau` through the G2
fixture owner; it does not hand-copy or reinterpret the manifest. The historical
`roblox/generated/G1cReferenceManifest.luau` remains validator coverage and is not the G2 oracle.

## G2 fixture owner

`tools/g2-runtime-fixture-content.ts` is the single deterministic content owner. Use:

```text
npm run g2:fixtures:generate
npm run g2:fixtures:check
```

The generate command is the only supported writer. The non-mutating check command is part of
`npm run validate` and compares exact UTF-8 bytes. `examples/g2-runtime/fixture-index.json` records
fixture identity, manifest/source hashes, and collection counts.

| Fixture ID                | Generated Luau destination                              | JSON evidence                                      | Coverage                         |
| ------------------------- | ------------------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| `reference`               | `roblox/generated/G2ReferenceManifestV03.luau`          | Existing G1d reference JSON                        | Authoritative 15-stage transport |
| `minimum-zero-checkpoint` | `roblox/generated/G2ZeroCheckpointManifestV03.luau`     | `examples/g2-runtime/minimum-zero-checkpoint.json` | Five stages, zero checkpoints    |
| `boundary-20`             | `roblox/generated/G2Boundary20ManifestV03.luau`         | `examples/g2-runtime/boundary-20.json`             | 20-stage boundary                |
| `boundary-21`             | `roblox/generated/G2Boundary21ManifestV03.luau`         | `examples/g2-runtime/boundary-21.json`             | 21-stage boundary                |
| `maximum-50`              | `roblox/generated/G2Maximum50ManifestV03.luau`          | `examples/g2-runtime/maximum-50.json`              | Maximum 50-stage route           |
| `maximum-checkpoints`     | `roblox/generated/G2MaximumCheckpointsManifestV03.luau` | `examples/g2-runtime/maximum-checkpoints.json`     | 49 checkpoints at 50 stages      |
| `wedge`                   | `roblox/generated/G2WedgeManifestV03.luau`              | `examples/g2-runtime/wedge.json`                   | Native Wedge mapping             |
| `decorative`              | `roblox/generated/G2DecorativeManifestV03.luau`         | `examples/g2-runtime/decorative.json`              | Decorative collision safety      |
| `replacement-b`           | `roblox/generated/G2ReplacementManifestV03.luau`        | `examples/g2-runtime/replacement-b.json`           | Distinct valid replacement       |
| `maximum-parts`           | `roblox/generated/G2MaximumPartsManifestV03.luau`       | `examples/g2-runtime/maximum-parts.json`           | 757 manifest Parts               |

All inputs use the committed G0/G1 authorities and `buildG1ArtifactSet`. A fixture cannot be mutated
after hashing. Any required contract change stops G2 for separate review.

## G2c construction evidence

G2c extends the same owner with independently valid, deterministic fixtures for native-shape,
decorative, replacement, and maximum-Part construction. It preserves the exact bytes and identities
of the merged G2b fixtures. Failure injection is runtime test configuration and never a hash-invalid
fixture mutation.

Scenario ownership remains:

| Scenario              | G2c evidence owner                                                          |
| --------------------- | --------------------------------------------------------------------------- |
| Replacement success   | Two independently valid generated manifests                                 |
| Replacement failure   | Deterministic factory/session failure injector, never hash-invalid mutation |
| Stale callbacks       | Deferred to the G2d runtime-session fake event scheduler                    |
| Two players           | Deferred to G2d fake Players service plus manual two-client Studio run      |
| Same-manifest rebuild | One valid manifest loaded under distinct runtime generations                |

## Review rules

- Checks compare exact bytes; semantic JSON equality is insufficient for Luau transport drift.
- Every fixture change includes its authority/input change and regenerated output in one PR.
- `roblox/generated/` and `examples/g2-runtime/` are generated-only and ignored by formatters that
  would rewrite canonical bytes.
- The active `roblox/default.project.json` continues to select the SceneManifest 0.2 path.
- G2b fixture modules are test evidence only; their presence does not activate 0.3 construction.
